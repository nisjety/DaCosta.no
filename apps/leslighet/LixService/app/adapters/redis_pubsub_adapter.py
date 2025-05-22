"""
/Volumes/Lagring/services/ReadabilityService/LixService/app/adapters/redis_pubsub_adapter.py
Redis Pub/Sub adapter for LixService.
Handles Redis connection management and message publishing/subscribing.
"""
import os
import json
import asyncio
import redis.asyncio as redis
import structlog
from typing import Dict, Any, Callable, Optional, List
from datetime import datetime
from app.config import settings


# Configure structured logging
logger = structlog.get_logger()

class RedisPubSubAdapter:
    """Adapter for Redis Pub/Sub communications"""
    
    def __init__(self):
        """Initialize Redis adapter with configuration"""
        # Use dedicated PubSub Redis if configured, otherwise fall back to regular Redis
        self._config = {
            'host': os.getenv('PUBSUB_REDIS_HOST', os.getenv('REDIS_HOST', 'localhost')),
            'port': int(os.getenv('PUBSUB_REDIS_PORT', os.getenv('REDIS_PORT', '6379'))),
            'password': os.getenv('PUBSUB_REDIS_PASSWORD', os.getenv('REDIS_PASSWORD', '')),
            'db': int(os.getenv('PUBSUB_REDIS_DB', os.getenv('REDIS_DB', '0'))),
            # Channel names
            'channels': {
                'SPELLCHECK': 'readability:spellcheck',
                'GRAMMAR': 'readability:grammar',
                'LIX': 'readability:lix',
                'NLP': 'readability:nlp',
                # Control channels
                'CONTROL': 'readability:control',
                'HEARTBEAT': 'readability:heartbeat',
            },
        }
        
        self._redis = None  # Redis client
        self._pubsub = None  # Redis pubsub connection
        self._connection_lock = asyncio.Lock()
        self._subscriptions = {}  # Channel -> callback mappings
        self._subscriber_task = None
        self._metrics = {
            'published_messages': 0,
            'received_messages': 0,
            'errors': 0,
            'last_error': None,
            'start_time': datetime.now().isoformat(),
        }
    
    async def connect(self) -> bool:
        """
        Connect to Redis and initialize publisher/subscriber
        
        Returns:
            bool: True if connection successful
        """
        # Use lock to prevent multiple simultaneous connection attempts
        async with self._connection_lock:
            if self._redis is not None:
                return True
                
            try:
                # Create Redis connection
                self._redis = redis.Redis(
                    host=self._config['host'],
                    port=self._config['port'],
                    password=self._config['password'] or None,
                    db=self._config['db'],
                    decode_responses=True
                )
                
                # Create PubSub connection
                self._pubsub = self._redis.pubsub()
                
                # Note: We no longer start the message listener here
                # It will be started after the first subscription
                
                logger.info(
                    "Redis connection established",
                    host=self._config['host'],
                    port=self._config['port']
                )
                
                return True
                
            except Exception as e:
                self._metrics['errors'] += 1
                self._metrics['last_error'] = {
                    'timestamp': datetime.now().isoformat(),
                    'message': str(e),
                    'type': 'connection'
                }
                logger.error(
                    "Failed to connect to Redis",
                    error=str(e),
                    host=self._config['host']
                )
                return False
    
    async def _message_listener(self):
        """Background task to listen for messages on subscribed channels"""
        try:
            # Only proceed if we have active subscriptions
            if not self._subscriptions:
                logger.warning("Message listener started without active subscriptions")
                
            while True:
                if self._pubsub is None:
                    logger.error("PubSub connection not initialized")
                    await asyncio.sleep(1)  # Wait before retrying
                    continue
                    
                try:
                    message = await self._pubsub.get_message(timeout=1)
                    if message and message['type'] == 'message':
                        self._metrics['received_messages'] += 1
                        channel = message['channel']
                        data = message.get('data', '')
                        
                        # Find and call the appropriate callback
                        if channel in self._subscriptions:
                            callback = self._subscriptions[channel]
                            try:
                                await callback(data)
                            except Exception as e:
                                self._metrics['errors'] += 1
                                self._metrics['last_error'] = {
                                    'timestamp': datetime.now().isoformat(),
                                    'message': str(e),
                                    'type': 'callback',
                                    'channel': channel
                                }
                                logger.error(
                                    "Error in message callback",
                                    error=str(e),
                                    channel=channel
                                )
                except redis.RedisError as e:
                    self._metrics['errors'] += 1
                    self._metrics['last_error'] = {
                        'timestamp': datetime.now().isoformat(),
                        'message': str(e),
                        'type': 'redis_error'
                    }
                    logger.error("Redis message listener error", error=str(e))
                    await asyncio.sleep(1)  # Prevent rapid retries on persistent errors

                await asyncio.sleep(0.01)  # Small delay to prevent CPU spinning
                
        except asyncio.CancelledError:
            # Task was cancelled - normal shutdown
            logger.info("Redis message listener stopped")
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'listener'
            }
            logger.error("Redis message listener error", error=str(e))
            # Attempt to restart the listener
            if not self._subscriber_task or self._subscriber_task.done():
                self._subscriber_task = asyncio.create_task(self._message_listener())
    
    async def publish(self, channel: str, data: Any) -> bool:
        """
        Publish a message to a Redis channel
        
        Args:
            channel: The channel to publish to
            data: The data to publish
            
        Returns:
            bool: True if successful
        """
        if not self._redis:
            await self.connect()
            
        if not self._redis:
            return False
            
        try:
            # Convert data to string if needed
            message = data if isinstance(data, str) else json.dumps(data)
            
            # Publish the message
            result = await self._redis.publish(channel, message)
            self._metrics['published_messages'] += 1
            return result > 0
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'publish',
                'channel': channel
            }
            logger.error(
                "Error publishing to Redis",
                error=str(e),
                channel=channel
            )
            return False
    
    async def publish_status(self, status: str) -> bool:
        """
        Publish LIX service status to control channel
        
        Args:
            status: Status message ('online', 'offline', etc)
            
        Returns:
            bool: True if successful
        """
        data = {
            'action': 'status',
            'service': 'lix',
            'status': status,
            'capabilities': ['readability_score', 'sentence_analysis', 'text_complexity'],
            'timestamp': datetime.now().isoformat()
        }
        return await self.publish(self._config['channels']['CONTROL'], data)
    
    async def subscribe(self, channel: str, callback: Callable) -> bool:
        """
        Subscribe to a Redis channel
        
        Args:
            channel: The channel to subscribe to
            callback: Async function to call when messages arrive
            
        Returns:
            bool: True if successful
        """
        if not self._redis:
            await self.connect()
            
        if not self._redis:
            return False
            
        try:
            # Subscribe to the channel
            await self._pubsub.subscribe(channel)
            self._subscriptions[channel] = callback
            
            # Start message listener if it's not running yet
            if self._subscriber_task is None or self._subscriber_task.done():
                self._subscriber_task = asyncio.create_task(self._message_listener())
                logger.info("Redis message listener started")
            
            logger.info("Subscribed to Redis channel", channel=channel)
            return True
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'subscribe',
                'channel': channel
            }
            logger.error(
                "Error subscribing to Redis channel", 
                error=str(e),
                channel=channel
            )
            return False
    
    async def unsubscribe(self, channel: str) -> bool:
        """
        Unsubscribe from a Redis channel
        
        Args:
            channel: The channel to unsubscribe from
            
        Returns:
            bool: True if successful
        """
        if not self._redis or not self._pubsub:
            return False
            
        try:
            # Unsubscribe from the channel
            await self._pubsub.unsubscribe(channel)
            
            # Remove callback
            if channel in self._subscriptions:
                del self._subscriptions[channel]
                
            logger.info("Unsubscribed from Redis channel", channel=channel)
            
            # If no more subscriptions, cancel the listener task
            if not self._subscriptions and self._subscriber_task:
                self._subscriber_task.cancel()
                self._subscriber_task = None
                logger.info("Redis message listener stopped - no active subscriptions")
                
            return True
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'unsubscribe',
                'channel': channel
            }
            logger.error(
                "Error unsubscribing from Redis channel",
                error=str(e),
                channel=channel
            )
            return False
    
    async def close(self):
        """Close Redis connections"""
        try:
            # Cancel message listener
            if self._subscriber_task and not self._subscriber_task.done():
                self._subscriber_task.cancel()
                try:
                    await self._subscriber_task
                except asyncio.CancelledError:
                    pass
                    
            # Close PubSub connection
            if self._pubsub:
                await self._pubsub.unsubscribe()
                await self._pubsub.close()
                
            # Close Redis connection
            if self._redis:
                await self._redis.close()
                await self._redis.wait_closed()
                
            self._pubsub = None
            self._redis = None
            self._subscriptions = {}
            self._subscriber_task = None
            
            logger.info("Redis connections closed")
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'close'
            }
            logger.error("Error closing Redis connections", error=str(e))
    
    def get_channels(self) -> Dict[str, str]:
        """Get the list of available channels"""
        return self._config['channels']
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get metrics about Redis Pub/Sub usage"""
        connected = self._redis is not None
        return {
            **self._metrics,
            'connection_status': 'connected' if connected else 'disconnected',
            'subscriptions': list(self._subscriptions.keys()),
            'timestamp': datetime.now().isoformat(),
            'uptime': (datetime.now() - datetime.fromisoformat(self._metrics['start_time'])).total_seconds() if connected else 0,
        }


# Export singleton instance
redis_pubsub = RedisPubSubAdapter()