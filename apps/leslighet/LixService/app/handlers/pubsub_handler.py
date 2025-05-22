"""
/Volumes/Lagring/services/ReadabilityService/LixService/app/handlers/pubsub_handler.py
Redis PubSub handler for LixService.
Handles incoming and outgoing messages via Redis Pub/Sub.
Uses RabbitMQ for critical message persistence.
"""
import json
import asyncio
import uuid
import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime
import structlog

from app.services.readability import ReadabilityService
from app.adapters.redis_pubsub_adapter import redis_pubsub
from app.adapters.rabbitmq_adapter import rabbitmq_adapter

# Configure structured logging
logger = structlog.get_logger()

class PubSubHandler:
    """Handler for Redis Pub/Sub messages with RabbitMQ persistence for critical messages"""
    
    def __init__(self):
        """Initialize the PubSub handler"""
        # Import enhanced_readability_service during initialization to avoid circular imports
        from app.services.enhanced_readability import enhanced_readability_service
        self._readability_service = enhanced_readability_service
        self._running = False
        self._pending_requests = {}
        self._metrics = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'processing_times': [],
            'avg_processing_time': 0,
            'metrics_published': 0,
        }
        
    async def start(self):
        """Start the PubSub handler"""
        if self._running:
            return
            
        try:
            # Connect to Redis
            await redis_pubsub.connect()
            
            # Connect to RabbitMQ for persistent messaging
            await rabbitmq_adapter.connect()
            
            # Process persisted messages from RabbitMQ
            await rabbitmq_adapter.consume(self._handle_persisted_message)
            
            # Announce service availability
            await redis_pubsub.publish_status('online')
            
            # Subscribe to LIX channel
            await redis_pubsub.subscribe(
                redis_pubsub.get_channels()['LIX'],
                self._handle_message
            )
            
            # Subscribe to heartbeat channel
            await redis_pubsub.subscribe(
                redis_pubsub.get_channels()['HEARTBEAT'],
                self._handle_heartbeat
            )
            
            self._running = True
            logger.info("LixService PubSub handler started")
            
        except Exception as e:
            logger.error("Failed to start PubSub handler", error=str(e))
            raise e
    
    async def _handle_message(self, message_str: str):
        """
        Process an incoming message from Redis
        
        Args:
            message_str: JSON string message
        """
        start_time = datetime.now().timestamp()
        client_id = None
        request_id = None
        
        try:
            # Parse message - ensure it's valid JSON first
            if not message_str:
                logger.error('Received empty message')
                return
                
            try:
                message = json.loads(message_str) if isinstance(message_str, str) else message_str
            except json.JSONDecodeError as e:
                logger.error(f'Invalid JSON in message: {e}')
                return
                
            # Extract client_id and request_id safely
            client_id = message.get('clientId', None)
            request_id = message.get('requestId') or str(uuid.uuid4())
            
            # Log received message for debugging
            logger.debug('Received message', message=message)
            
            # Validate message is a dictionary
            if not isinstance(message, dict):
                error_msg = 'Invalid message format: not a dictionary'
                logger.error(error_msg, message_type=type(message).__name__)
                await self._send_error_response(client_id, error_msg, request_id)
                return
                
            # Extract text and options from message - handle both formats
            text = None
            options = {}
            
            # Check if text is at top level (Gateway realtime format)
            if 'text' in message and message.get('text') is not None and isinstance(message['text'], str):
                text = message['text']
                # Extract options from top-level fields
                for option_key in ['include_word_analysis', 'include_sentence_analysis']:
                    if option_key in message:
                        options[option_key] = message[option_key]
            
            # If not at top level, check if content object exists (old format)
            elif 'content' in message and message.get('content') is not None and isinstance(message['content'], dict):
                content = message['content']
                if 'text' in content and content.get('text') is not None and isinstance(content['text'], str):
                    text = content['text']
                    # Extract other options from content
                    for key, value in content.items():
                        if key != 'text':
                            options[key] = value
            
            # Validate we have the required text field
            if text is None or text == '':
                error_msg = 'Invalid content format: missing or empty text field'
                logger.error(error_msg, message=str(message))
                await self._send_error_response(client_id, error_msg, request_id)
                return
                
            # Store in pending requests
            self._pending_requests[request_id] = {
                'client_id': client_id,
                'start_time': start_time,
                'text_preview': text[:50] + ('...' if len(text) > 50 else '')
            }
            
            self._metrics['total_requests'] += 1
            
            # Process the text with the readability service
            is_critical = options.get('is_critical', False)
            
            # For critical messages, use RabbitMQ for persistence
            if is_critical:
                # Store in RabbitMQ for guaranteed processing
                await rabbitmq_adapter.publish(
                    message={
                        'clientId': client_id,
                        'requestId': request_id,
                        'text': text,
                        'options': options,
                    },
                    priority=options.get('priority', 5)  # Default medium priority
                )
                
                # Send acknowledgment through Redis
                await redis_pubsub.publish(
                    redis_pubsub.get_channels()['LIX'],
                    {
                        'clientId': client_id,
                        'requestId': request_id,
                        'status': 'persisted',
                        'message': 'Request persisted for guaranteed processing',
                        'timestamp': datetime.now().isoformat()
                    }
                )
            else:
                # Process directly for non-critical messages
                result = await self._readability_service.analyze_text(
                    text,
                    options
                )
                
                # Send result back via Redis
                await redis_pubsub.publish(
                    redis_pubsub.get_channels()['LIX'],
                    {
                        'clientId': client_id,
                        'requestId': request_id,
                        'content': result,
                        'timestamp': datetime.now().isoformat()
                    }
                )
                
                # Update metrics
                self._metrics['successful_requests'] += 1
                processing_time = datetime.now().timestamp() - start_time
                self._metrics['processing_times'].append(processing_time)
                
                # Keep only last 100 processing times
                if len(self._metrics['processing_times']) > 100:
                    self._metrics['processing_times'] = self._metrics['processing_times'][-100:]
                
                # Calculate average processing time
                if self._metrics['processing_times']:
                    self._metrics['avg_processing_time'] = sum(self._metrics['processing_times']) / len(self._metrics['processing_times'])
                
                # Publish the LIX metrics for other services (like NLPService) to consume
                await self.publish_lix_metrics(text, result)
                
            # Clean up pending request
            if request_id in self._pending_requests:
                del self._pending_requests[request_id]
                
        except Exception as e:
            logger.error(
                'Error processing message',
                error=str(e),
                client_id=client_id,
                request_id=request_id,
                traceback=traceback.format_exc()
            )
            self._metrics['failed_requests'] += 1
            
            # Send error response
            await self._send_error_response(
                client_id,
                f'Error processing request: {str(e)}',
                request_id
            )
            
            # Clean up pending request
            if request_id and request_id in self._pending_requests:
                del self._pending_requests[request_id]
    
    async def publish_lix_metrics(self, text: str, result: Dict[str, Any]):
        """
        Publish LIX metrics to Redis PubSub so other services (especially NLPService) 
        can use the same metrics
        
        Args:
            text: The original text that was analyzed
            result: The analysis result containing readability metrics
        """
        try:
            # Create a metrics message with the text and readability results
            metrics_message = {
                'text': text,  # Include the original text for hash matching
                'metrics': {
                    'lix': result.get('readability', {}).get('lix', {}),
                    'text_statistics': result.get('text_analysis', {}).get('statistics', {})
                },
                'timestamp': datetime.now().isoformat()
            }
            
            # Publish to the LIX metrics channel
            await redis_pubsub.publish(
                redis_pubsub.get_channels()['LIX'],  # Use the LIX channel for metrics
                metrics_message
            )
            
            # Update metrics count
            self._metrics['metrics_published'] += 1
            logger.debug('Published LIX metrics to Redis PubSub')
            
        except Exception as e:
            logger.error('Error publishing LIX metrics', error=str(e))
    
    async def _handle_persisted_message(self, message_data: Dict[str, Any], headers: Dict[str, Any]):
        """
        Process a message from RabbitMQ persistence queue
        
        Args:
            message_data: The message data
            headers: Message headers from RabbitMQ
        """
        try:
            client_id = message_data.get('clientId')
            request_id = message_data.get('requestId')
            content = message_data.get('content', {})
            
            logger.info(
                "Processing persisted message from RabbitMQ",
                client_id=client_id,
                request_id=request_id
            )
            
            # Process with the readability service
            result = await self._readability_service.analyze_text(
                content['text'],
                content.get('options', {})
            )
            
            # Send result back via Redis
            await redis_pubsub.publish(
                redis_pubsub.get_channels()['LIX'],
                {
                    'clientId': client_id,
                    'requestId': request_id,
                    'content': result,
                    'persisted': True,  # Mark as processed from persistence queue
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            self._metrics['successful_requests'] += 1
            
            # Also publish the LIX metrics for persisted messages
            await self.publish_lix_metrics(content['text'], result)
            
        except Exception as e:
            logger.error(
                "Error processing persisted message",
                error=str(e),
                client_id=message_data.get('clientId')
            )
            self._metrics['failed_requests'] += 1
            
            # Send error response via Redis
            await self._send_error_response(
                message_data.get('clientId'),
                f"Error processing persisted request: {str(e)}",
                message_data.get('requestId')
            )
    
    async def _handle_heartbeat(self, message_str: str):
        """
        Handle heartbeat messages
        
        Args:
            message_str: JSON string message
        """
        try:
            message = json.loads(message_str) if isinstance(message_str, str) else message_str
            
            if message.get('action') == 'ping':
                # Reply to ping with service status
                await redis_pubsub.publish(
                    redis_pubsub.get_channels()['HEARTBEAT'],
                    {
                        'action': 'pong',
                        'service': 'lix',
                        'status': 'healthy',
                        'metrics': self.get_metrics(),
                        'timestamp': datetime.now().isoformat()
                    }
                )
        except Exception as e:
            logger.error("Error handling heartbeat", error=str(e))
    
    async def _send_error_response(self, client_id: str, error_message: str, request_id: str = None):
        """
        Send error response back to client
        
        Args:
            client_id: Client ID
            error_message: Error message
            request_id: Request ID
        """
        if not client_id:
            return
            
        try:
            await redis_pubsub.publish(
                redis_pubsub.get_channels()['LIX'],
                {
                    'clientId': client_id,
                    'requestId': request_id or str(uuid.uuid4()),
                    'content': {
                        'error': error_message,
                        'success': False
                    },
                    'timestamp': datetime.now().isoformat()
                }
            )
        except Exception as e:
            logger.error("Error sending error response", error=str(e))
    
    async def stop(self):
        """Stop the PubSub handler"""
        if not self._running:
            return
            
        try:
            # Announce service unavailability
            await redis_pubsub.publish_status('offline')
            
            # Close Redis connections
            await redis_pubsub.close()
            
            # Close RabbitMQ connection
            await rabbitmq_adapter.close()
            
            self._running = False
            logger.info("LixService PubSub handler stopped")
            
        except Exception as e:
            logger.error("Error stopping PubSub handler", error=str(e))
            raise e
    
    @property
    def running(self):
        """Check if the handler is running"""
        return self._running
    
    def get_metrics(self):
        """Get handler metrics"""
        return {
            **self._metrics,
            'pending_requests': len(self._pending_requests),
            'redis_metrics': redis_pubsub.get_metrics(),
            'rabbitmq_metrics': rabbitmq_adapter.get_metrics(),
            'timestamp': datetime.now().isoformat(),
        }


# Export singleton instance
pubsub_handler = PubSubHandler()