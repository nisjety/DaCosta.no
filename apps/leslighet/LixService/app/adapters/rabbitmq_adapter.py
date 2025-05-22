"""
/Volumes/Lagring/services/ReadabilityService/LixService/app/adapters/rabbitmq_adapter.py
RabbitMQ adapter for persistent messaging in LixService.
Provides durability for critical messages that must be delivered reliably.
"""
import os
import json
import asyncio
import aio_pika
import structlog
from typing import Dict, Any, Callable, Optional, List
from datetime import datetime

# Configure structured logging
logger = structlog.get_logger()

class RabbitMQAdapter:
    """Adapter for RabbitMQ message persistence and reliable delivery"""
    
    def __init__(self):
        """Initialize RabbitMQ adapter with configuration"""
        self._config = {
            'host': os.getenv('RABBITMQ_HOST', 'localhost'),
            'port': int(os.getenv('RABBITMQ_PORT', '5672')),
            'user': os.getenv('RABBITMQ_USER', 'guest'),
            'password': os.getenv('RABBITMQ_PASSWORD', 'guest'),
            'vhost': os.getenv('RABBITMQ_VHOST', '/'),
            'queue_name': os.getenv('RABBITMQ_QUEUE_NAME', 'lix_persistent_queue'),
            'exchange_name': 'readability.persistent',
            'routing_key': 'lix.critical',
            'prefetch_count': 10,
        }
        self._connection = None
        self._channel = None
        self._exchange = None
        self._queue = None
        self._consumer_tag = None
        self._connect_lock = asyncio.Lock()
        self._message_handlers = []
        self._running = False
        self._metrics = {
            'published_messages': 0,
            'consumed_messages': 0,
            'errors': 0,
            'reconnect_count': 0,
            'last_error': None,
        }
    
    async def connect(self) -> bool:
        """
        Connect to RabbitMQ server and set up channel, exchange and queue
        
        Returns:
            bool: True if connection successful
        """
        # Use lock to prevent multiple simultaneous connection attempts
        async with self._connect_lock:
            if self._connection and not self._connection.is_closed:
                return True
                
            try:
                # Construct connection URI
                connection_uri = f"amqp://{self._config['user']}:{self._config['password']}@{self._config['host']}:{self._config['port']}/{self._config['vhost']}"
                
                # Connect to RabbitMQ
                self._connection = await aio_pika.connect_robust(
                    connection_uri,
                    timeout=10.0,
                    reconnect_interval=2.0
                )
                
                # Create channel
                self._channel = await self._connection.channel()
                
                # Set QoS
                await self._channel.set_qos(prefetch_count=self._config['prefetch_count'])
                
                # Declare exchange
                self._exchange = await self._channel.declare_exchange(
                    self._config['exchange_name'],
                    aio_pika.ExchangeType.DIRECT,
                    durable=True
                )
                
                # Declare queue
                self._queue = await self._channel.declare_queue(
                    self._config['queue_name'],
                    durable=True,
                    auto_delete=False
                )
                
                # Bind queue to exchange
                await self._queue.bind(
                    self._exchange,
                    routing_key=self._config['routing_key']
                )
                
                logger.info(
                    "RabbitMQ connection established",
                    host=self._config['host'],
                    queue=self._config['queue_name']
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
                    "Failed to connect to RabbitMQ",
                    error=str(e),
                    host=self._config['host']
                )
                return False
    
    async def publish(self, message: Dict[str, Any], priority: int = 0) -> bool:
        """
        Publish a message to RabbitMQ for reliable delivery
        
        Args:
            message (Dict): The message data to publish
            priority (int, optional): Message priority (0-9), higher is more important
            
        Returns:
            bool: True if message was published successfully
        """
        try:
            if not self._connection or self._connection.is_closed:
                await self.connect()
                
            if not self._connection or self._connection.is_closed:
                logger.error("Failed to publish - no RabbitMQ connection")
                return False
                
            # Convert message to JSON
            message_body = json.dumps(message).encode('utf-8')
            
            # Create a message with persistence and priority
            rabbit_message = aio_pika.Message(
                body=message_body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                priority=min(priority, 9) if priority else 0,
                timestamp=datetime.now().timestamp(),
                headers={
                    'content_type': 'application/json',
                    'source': 'lix_service',
                    'persistent': True,
                }
            )
            
            # Publish message to exchange
            await self._exchange.publish(
                rabbit_message,
                routing_key=self._config['routing_key']
            )
            
            self._metrics['published_messages'] += 1
            return True
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'publish'
            }
            logger.error("Error publishing message to RabbitMQ", error=str(e))
            return False
    
    async def consume(self, callback: Callable) -> None:
        """
        Start consuming messages from the queue
        
        Args:
            callback: Async function to process consumed messages
        """
        # Add callback to handlers
        self._message_handlers.append(callback)
        
        if not self._running:
            await self._start_consuming()
    
    async def _start_consuming(self) -> None:
        """Start consuming messages from the queue"""
        try:
            if not self._connection or self._connection.is_closed:
                await self.connect()
                
            if not self._connection or self._connection.is_closed:
                logger.error("Failed to start consuming - no RabbitMQ connection")
                return
                
            # Start consuming messages
            self._consumer_tag = await self._queue.consume(self._process_message)
            self._running = True
            
            logger.info(
                "Started consuming messages from RabbitMQ",
                queue=self._config['queue_name'],
                consumer_tag=self._consumer_tag
            )
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'consume_start'
            }
            logger.error("Error starting RabbitMQ consumer", error=str(e))
    
    async def _process_message(self, message: aio_pika.IncomingMessage) -> None:
        """
        Process an incoming message
        
        Args:
            message: The incoming message from RabbitMQ
        """
        async with message.process():
            try:
                # Parse message body
                message_body = message.body.decode('utf-8')
                message_data = json.loads(message_body)
                
                # Call all registered handlers
                for handler in self._message_handlers:
                    await handler(message_data, message.headers)
                
                self._metrics['consumed_messages'] += 1
                
            except Exception as e:
                self._metrics['errors'] += 1
                self._metrics['last_error'] = {
                    'timestamp': datetime.now().isoformat(),
                    'message': str(e),
                    'type': 'process_message'
                }
                logger.error("Error processing RabbitMQ message", error=str(e))
                # NACK the message to requeue it if processing failed
                # message.nack(requeue=True)  # We don't need this with process() context manager
    
    async def stop_consuming(self) -> None:
        """Stop consuming messages from the queue"""
        if self._channel and self._consumer_tag:
            await self._channel.cancel(self._consumer_tag)
            self._consumer_tag = None
            self._running = False
            logger.info("Stopped consuming messages from RabbitMQ")
    
    async def close(self) -> None:
        """Close the connection to RabbitMQ"""
        try:
            if self._running:
                await self.stop_consuming()
                
            if self._connection and not self._connection.is_closed:
                await self._connection.close()
                self._connection = None
                self._channel = None
                self._exchange = None
                self._queue = None
                
            logger.info("RabbitMQ connection closed")
            
        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = {
                'timestamp': datetime.now().isoformat(),
                'message': str(e),
                'type': 'close'
            }
            logger.error("Error closing RabbitMQ connection", error=str(e))
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get metrics about RabbitMQ adapter usage"""
        return {
            **self._metrics,
            'connection_status': 'connected' if (self._connection and not self._connection.is_closed) else 'disconnected',
            'consumer_status': 'running' if self._running else 'stopped',
            'consumer_count': len(self._message_handlers),
            'queue_name': self._config['queue_name'],
            'timestamp': datetime.now().isoformat(),
        }
        
    async def create_consumer(self, queue_name: str, exchange_name: str, routing_key: str):
        """
        Create a consumer for a specific queue
        
        Args:
            queue_name: Name of the queue to consume from
            exchange_name: Name of the exchange the queue is bound to
            routing_key: Routing key used to bind queue to exchange
            
        Returns:
            An async generator that yields messages from the queue
        """
        if not self._connection or self._connection.is_closed:
            await self.connect()
            
        if not self._connection or self._connection.is_closed:
            logger.error("Failed to create consumer - no RabbitMQ connection")
            return None
            
        # Create a new channel for this consumer
        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=self._config['prefetch_count'])
        
        # Declare exchange
        exchange = await channel.declare_exchange(
            exchange_name,
            aio_pika.ExchangeType.DIRECT,
            durable=True
        )
        
        # Declare queue
        queue = await channel.declare_queue(
            queue_name,
            durable=True,
            auto_delete=False
        )
        
        # Bind queue to exchange if routing key is provided
        if routing_key:
            await queue.bind(
                exchange,
                routing_key=routing_key
            )
            
        logger.info(
            "Created RabbitMQ consumer",
            queue=queue_name,
            exchange=exchange_name,
            routing_key=routing_key
        )
        
        # Create async generator for consuming messages
        async def message_generator():
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    async with message.process():
                        try:
                            message_body = message.body.decode('utf-8')
                            message_data = json.loads(message_body)
                            self._metrics['consumed_messages'] += 1
                            yield message_data
                        except Exception as e:
                            self._metrics['errors'] += 1
                            self._metrics['last_error'] = {
                                'timestamp': datetime.now().isoformat(),
                                'message': str(e),
                                'type': 'consumer_message'
                            }
                            logger.error("Error processing message in consumer", error=str(e))
        
        return message_generator()


# Export singleton instance
rabbitmq_adapter = RabbitMQAdapter()