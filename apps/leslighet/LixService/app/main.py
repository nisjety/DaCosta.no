from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import os
import time
import uvicorn
import asyncio
import json
import redis.asyncio as redis
import logging
import structlog
import psutil
import hashlib
# Add these new imports
import httpx
import uuid
from sse_starlette.sse import EventSourceResponse
from app.services.factory import get_text_parser, get_recommender, get_word_analyzer
from app.services.circuit_breaker import CircuitBreaker
# Add Prometheus imports
from prometheus_client import Counter, Histogram, Gauge
from prometheus_fastapi_instrumentator import Instrumentator

# Import the response model
from app.models import FullAnalysisResponse
from app.config import settings


# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure structured logging
logger = structlog.get_logger()

# Import our services
from app.services.readability import ReadabilityService
from app.services.text_analysis import TextAnalysisService
# Add import for our PubSub handler
from app.handlers.pubsub_handler import pubsub_handler
# Import RabbitMQ adapter
from app.adapters.rabbitmq_adapter import rabbitmq_adapter

# Redis configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')
REDIS_CACHE_TTL = int(os.getenv('REDIS_CACHE_TTL', '3600'))  # 1 hour default
REDIS_CACHE_TTL_SMALL = int(os.getenv('REDIS_CACHE_TTL_SMALL', '7200'))  # 2 hours for small texts
REDIS_CACHE_TTL_LARGE = int(os.getenv('REDIS_CACHE_TTL_LARGE', '1800'))  # 30 minutes for large texts

# Cache size thresholds (in characters)
SMALL_TEXT_THRESHOLD = 1000  # Less than 1000 chars is considered small
LARGE_TEXT_THRESHOLD = 10000  # More than 10000 chars is considered large

# RabbitMQ configuration
RABBITMQ_EXCHANGE = os.getenv('RABBITMQ_EXCHANGE', 'readability.persistent')
RABBITMQ_ROUTING_KEY = os.getenv('RABBITMQ_ROUTING_KEY', 'lix.analysis')
RABBITMQ_QUEUE_NAME = os.getenv('RABBITMQ_QUEUE_NAME', 'lix_analysis_queue')

# Prometheus configuration
ENABLE_METRICS = os.getenv("ENABLE_METRICS", "true").lower() == "true"

# Create Redis pool with optimized connection parameters
redis_pool = redis.ConnectionPool(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    password=REDIS_PASSWORD,
    decode_responses=True,
    max_connections=20,  # Increase max connections for better parallelism
    socket_timeout=2.0,  # Reduce timeout for faster failure detection
    socket_keepalive=True,  # Keep connections alive
    health_check_interval=30  # Check connection health periodically
)

# Create FastAPI app
app = FastAPI(
    title="LixService",
    description="Service for analyzing text readability with LIX and RIX metrics",
    version="3.0.0",
)

# Define metrics
REQUEST_COUNT = Counter(
    "text_analysis_requests_total", 
    "Total count of text analysis requests",
    ["endpoint", "method"]
)
PROCESSING_TIME = Histogram(
    "text_analysis_processing_time_seconds", 
    "Time spent processing text analysis",
    ["endpoint"]
)
WORD_COUNT_GAUGE = Gauge(
    "text_analysis_word_count", 
    "Word count of analyzed text"
)
ERROR_COUNT = Counter(
    "text_analysis_errors_total", 
    "Total count of errors in text analysis",
    ["endpoint", "error_type"]
)
CACHE_HITS = Counter(
    "text_analysis_cache_hits_total",
    "Total count of cache hits",
    ["endpoint"]
)
CACHE_MISSES = Counter(
    "text_analysis_cache_misses_total",
    "Total count of cache misses",
    ["endpoint"]
)
SYSTEM_MEMORY = Gauge(
    "system_memory_usage_bytes",
    "Memory usage of the system",
    ["type"]
)
SYSTEM_CPU = Gauge(
    "system_cpu_usage_percent",
    "CPU usage percentage",
    ["cpu"]
)
# Add WebSocket metrics
ACTIVE_WEBSOCKET_CONNECTIONS = Gauge(
    "websocket_connections_active",
    "Number of active WebSocket connections"
)
WEBSOCKET_CACHE_HITS = Counter(
    "websocket_cache_hits_total",
    "Total count of cache hits from WebSocket connections"
)
WEBSOCKET_CACHE_MISSES = Counter(
    "websocket_cache_misses_total",
    "Total count of cache misses from WebSocket connections"
)
WEBSOCKET_PROCESSING_TIME = Histogram(
    "websocket_processing_time_seconds",
    "Time spent processing WebSocket text analysis requests"
)
REQUEST_LATENCY = Histogram(
    "request_latency_seconds",
    "Request latency in seconds",
    ["endpoint", "method"]
)

# Set up metrics instrumentation
if ENABLE_METRICS:
    Instrumentator().instrument(app).expose(app, include_in_schema=True, should_gzip=True)

# Utility function for better cache key generation
def generate_cache_key(text: str, include_word_analysis: bool = False, 
                      include_sentence_analysis: bool = True) -> str:
    """Generate a deterministic cache key based on text content and analysis options."""
    # Create a hash of text content and analysis options
    text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
    options_str = f":w{int(include_word_analysis)}:s{int(include_sentence_analysis)}"
    return f"analysis:{text_hash}{options_str}"

# Utility function to determine cache TTL based on text size
def get_cache_ttl(text: str) -> int:
    """Determine appropriate cache TTL based on text length."""
    text_length = len(text)
    if text_length < SMALL_TEXT_THRESHOLD:
        return REDIS_CACHE_TTL_SMALL  # Longer TTL for small texts (more likely to be reused)
    elif text_length > LARGE_TEXT_THRESHOLD:
        return REDIS_CACHE_TTL_LARGE  # Shorter TTL for large texts (consume more memory)
    else:
        return REDIS_CACHE_TTL  # Default TTL for medium texts

# Utility function for Redis operations with retry logic
async def redis_operation(operation_func, *args, retries=2, **kwargs):
    """Execute a Redis operation with retry logic."""
    for attempt in range(retries + 1):
        try:
            async with redis.Redis(connection_pool=redis_pool) as r:
                return await operation_func(r, *args, **kwargs)
        except (redis.ConnectionError, redis.TimeoutError) as e:
            if attempt == retries:
                logger.warning(f"Redis operation failed after {retries} retries", error=str(e))
                return None
            await asyncio.sleep(0.1)  # Brief pause before retry
        except Exception as e:
            logger.warning("Redis operation error", error=str(e))
            return None

# Cache getter with retry
async def get_from_cache(key: str):
    async def _get(r, key):
        return await r.get(key)
    return await redis_operation(_get, key)

# Cache setter with retry
async def set_in_cache(key: str, value: str, ttl: int):
    async def _set(r, key, value, ttl):
        return await r.set(key, value, ex=ttl)
    return await redis_operation(_set, key, value, ttl)

# Function to get a Redis connection with context manager
async def get_redis_pool():
    """Get Redis connection from pool using async context manager"""
    return redis.Redis(connection_pool=redis_pool)

# Add application event handlers
@app.on_event('startup')
async def startup_event():
    """Initialize services on application startup"""
    logger.info('Starting LixService')
    
    # Start PubSub handler
    try:
        await pubsub_handler.start()
        logger.info('Redis PubSub handler started')
    except Exception as e:
        logger.error('Failed to start Redis PubSub handler', error=str(e))
        # Don't fail startup - we can still operate with REST/WebSocket APIs
    
    # Connect to RabbitMQ
    try:
        await rabbitmq_adapter.connect()
        logger.info('RabbitMQ connection established')
    except Exception as e:
        logger.error('Failed to connect to RabbitMQ', error=str(e))
        # Don't fail startup - we can still operate without RabbitMQ

@app.on_event('shutdown')
async def shutdown_event():
    """Clean up resources on application shutdown"""
    logger.info('Shutting down LixService')
    
    # Stop PubSub handler
    try:
        await pubsub_handler.stop()
        logger.info('Redis PubSub handler stopped')
    except Exception as e:
        logger.error('Error stopping Redis PubSub handler', error=str(e))
    
    # Close RabbitMQ connection
    try:
        await rabbitmq_adapter.close()
        logger.info('RabbitMQ connection closed')
    except Exception as e:
        logger.error('Error closing RabbitMQ connection', error=str(e))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
HTML_PATH = os.path.join(STATIC_DIR, "index.html")

# Mount static files directory
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket disconnected")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Request models
class TextRequest(BaseModel):
    text: str
    include_word_analysis: Optional[bool] = Field(
        default=False, 
        description="Include detailed word analysis in response"
    )
    include_sentence_analysis: Optional[bool] = Field(
        default=True, 
        description="Include detailed sentence analysis in response"
    )
    user_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional context about the user or text purpose"
    )

# Add batch request model
class BatchTextRequest(BaseModel):
    texts: List[Dict[str, str]] = Field(..., 
        description="List of texts to analyze", 
        example=[{"id": "doc1", "content": "This is the first text."}, {"id": "doc2", "content": "This is the second text."}])
    priority: Optional[int] = Field(1, description="Priority of the batch job (1-10)")

@app.post("/analyze/batch")
async def analyze_text_batch(request: BatchTextRequest):
    """
    Analyze multiple texts in batch mode.
    
    Args:
        request: BatchTextRequest with list of texts
        
    Returns:
        Job ID and initial status
    """
    REQUEST_COUNT.labels(endpoint="/analyze/batch", method="POST").inc()
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    texts_count = len(request.texts)
    
    if texts_count == 0:
        ERROR_COUNT.labels(endpoint="/analyze/batch", error_type="empty_batch").inc()
        raise HTTPException(status_code=400, detail="Batch cannot be empty")
    
    if texts_count > 100:
        ERROR_COUNT.labels(endpoint="/analyze/batch", error_type="batch_too_large").inc()
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 100 texts")
    
    # Set up job in Redis
    job_data = {
        "status": "queued",
        "total": texts_count,
        "completed": 0,
        "failed": 0,
        "created_at": time.time(),
        "priority": min(max(request.priority, 1), 10),  # Clamp priority between 1-10
        "results": {}
    }
    
    # Store job data and text data
    async with get_redis_pool() as redis:
        # Store job metadata
        await redis.set(f"batch_job:{job_id}", json.dumps(job_data), ex=86400)  # 24 hour expiry
        
        # Queue job for processing
        texts_data = json.dumps(request.texts)
        await redis.set(f"batch_job:{job_id}:texts", texts_data, ex=86400)
        
        # Add to processing queue with priority
        await redis.zadd(
            "batch_processing_queue",
            {job_id: job_data["priority"]}
        )
    
    # Start background task to process the batch
    asyncio.create_task(process_batch_job(job_id))
    
    return {
        "job_id": job_id,
        "status": "queued",
        "texts_count": texts_count,
        "estimated_time": estimate_processing_time(texts_count)
    }

@app.get("/analyze/batch/{job_id}")
async def get_batch_status(job_id: str):
    """
    Get status of a batch job
    
    Args:
        job_id: ID of the batch job
        
    Returns:
        Job status and results if available
    """
    REQUEST_COUNT.labels(endpoint="/analyze/batch/status", method="GET").inc()
    
    async with get_redis_pool() as redis:
        job_data_str = await redis.get(f"batch_job:{job_id}")
        
        if not job_data_str:
            ERROR_COUNT.labels(endpoint="/analyze/batch/status", error_type="job_not_found").inc()
            raise HTTPException(status_code=404, detail="Batch job not found")
            
        job_data = json.loads(job_data_str)
        
        # If job is complete, include results
        if job_data["status"] == "completed":
            results_str = await redis.get(f"batch_job:{job_id}:results")
            if results_str:
                job_data["results"] = json.loads(results_str)
        
        return job_data

async def process_batch_job(job_id: str):
    """
    Process a batch job in the background
    
    Args:
        job_id: ID of the batch job to process
    """
    async with get_redis_pool() as redis:
        # Get job data
        job_data_str = await redis.get(f"batch_job:{job_id}")
        texts_data_str = await redis.get(f"batch_job:{job_id}:texts")
        
        if not job_data_str or not texts_data_str:
            logger.error(f"Cannot find job data or texts for job {job_id}")
            return
            
        job_data = json.loads(job_data_str)
        texts = json.loads(texts_data_str)
        
        # Update job status
        job_data["status"] = "processing"
        job_data["started_at"] = time.time()
        await redis.set(f"batch_job:{job_id}", json.dumps(job_data), ex=86400)
        
        # Process each text
        results = {}
        completed = 0
        failed = 0
        
        for text_item in texts:
            try:
                text_id = text_item.get("id", str(uuid.uuid4()))
                content = text_item.get("content", "")
                
                if not content:
                    failed += 1
                    results[text_id] = {"error": "Empty content"}
                    continue
                
                # Process the text
                readability_data = ReadabilityService.get_readability(content)
                text_analysis_data = TextAnalysisService.analyze_text(content)
                
                recommender = get_recommender()
                recommendations = recommender.generate({
                    "lix_score": readability_data["lix"]["score"],
                    "rix_score": readability_data["rix"]["score"],
                    "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
                    "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"]
                })
                
                results[text_id] = {
                    "readability": readability_data,
                    "analysis": text_analysis_data,
                    "recommendations": recommendations
                }
                
                completed += 1
                
                # Update progress every 5 texts
                if completed % 5 == 0:
                    job_data["completed"] = completed
                    job_data["failed"] = failed
                    await redis.set(f"batch_job:{job_id}", json.dumps(job_data), ex=86400)
                
            except Exception as e:
                logger.error(f"Error processing text in batch: {str(e)}")
                failed += 1
                results[text_id] = {"error": str(e)}
        
        # Update final job status
        job_data["status"] = "completed"
        job_data["completed"] = completed
        job_data["failed"] = failed
        job_data["completed_at"] = time.time()
        job_data["processing_time"] = job_data["completed_at"] - job_data.get("started_at", job_data["completed_at"])
        
        # Store results separately to keep job metadata small
        await redis.set(f"batch_job:{job_id}:results", json.dumps(results), ex=86400)
        await redis.set(f"batch_job:{job_id}", json.dumps(job_data), ex=86400)
        
        # Remove from processing queue
        await redis.zrem("batch_processing_queue", job_id)

def estimate_processing_time(text_count: int) -> float:
    """
    Estimate processing time for batch job based on text count
    
    Args:
        text_count: Number of texts in batch
        
    Returns:
        Estimated processing time in seconds
    """
    # Simple estimation model: base time + per-text time
    base_time = 2.0  # Base setup time in seconds
    per_text_time = 0.5  # Time per text in seconds
    
    return base_time + (per_text_time * text_count)

# Add a constant for large text that should be processed in background
BACKGROUND_PROCESSING_THRESHOLD = int(os.getenv('BACKGROUND_PROCESSING_THRESHOLD', '20000'))  # 20K chars

# Routes
@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """Serve the main application HTML."""
    try:
        with open(HTML_PATH, "r", encoding="utf-8") as file:
            html_content = file.read()
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error("Failed to serve index", error=str(e))
        return HTMLResponse(content=f"<h1>Error</h1><p>{str(e)}</p>", status_code=500)

@app.post("/analyze", response_model=FullAnalysisResponse)
async def analyze_text(request: TextRequest, background_tasks: BackgroundTasks):
    """
    Analyze text and return comprehensive readability and text analysis metrics.
    
    Args:
        request: TextRequest with the text to analyze
        background_tasks: FastAPI BackgroundTasks for processing large texts
        
    Returns:
        Full analysis results with readability metrics and text analysis
    """
    REQUEST_COUNT.labels(endpoint="/analyze", method="POST").inc()
    
    with PROCESSING_TIME.labels(endpoint="/analyze").time():
        start_time = time.time()
        
        try:
            text = request.text.strip()
            if not text:
                ERROR_COUNT.labels(endpoint="/analyze", error_type="empty_text").inc()
                raise HTTPException(status_code=400, detail="No text provided")
            
            # Generate improved cache key based on text content and analysis options
            cache_key = generate_cache_key(
                text,
                include_word_analysis=request.include_word_analysis,
                include_sentence_analysis=request.include_sentence_analysis
            )
            
            # Try to get from cache with optimized retrieval
            cached_result = await get_from_cache(cache_key)
            if cached_result:
                CACHE_HITS.labels(endpoint="/analyze").inc()
                result = json.loads(cached_result)
                result["cached"] = True
                result["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)
                return result
            
            CACHE_MISSES.labels(endpoint="/analyze").inc()
            
            # For large texts, perform async processing and return a task ID
            if len(text) > BACKGROUND_PROCESSING_THRESHOLD:
                # Create a task ID for the client to poll
                task_id = f"task-{hashlib.md5(text.encode('utf-8')).hexdigest()[:10]}-{int(time.time())}"
                
                # Store task status in Redis
                task_status_key = f"task_status:{task_id}"
                await set_in_cache(task_status_key, json.dumps({
                    "status": "processing",
                    "created": time.time()
                }), 3600)  # 1 hour TTL for task status
                
                # Add background task
                background_tasks.add_task(
                    process_text_analysis_background,
                    task_id=task_id,
                    text=text,
                    include_word_analysis=request.include_word_analysis,
                    include_sentence_analysis=request.include_sentence_analysis,
                    cache_key=cache_key,
                    user_context=request.user_context
                )
                
                # Return task ID to client
                return JSONResponse({
                    "task_id": task_id,
                    "status": "processing",
                    "polling_endpoint": f"/task/{task_id}",
                    "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                    "estimated_completion_seconds": max(5, len(text) // 10000)
                })
            
            # For smaller texts, process immediately
            # Track word count
            word_count = len(text.split())
            WORD_COUNT_GAUGE.set(word_count)
            
            # Get readability metrics
            readability_data = ReadabilityService.get_readability(text)
            logger.info("Readability data processed", lix_score=readability_data["lix"]["score"])
            
            # Get text analysis
            text_analysis_data = TextAnalysisService.analyze_text(text)
            logger.info("Text analysis data processed", word_count=text_analysis_data["statistics"]["word_count"])
            
            # Generate recommendations based on both readability and text analysis
            recommender = get_recommender()
            recommendations = recommender.generate({
                "lix_score": readability_data["lix"]["score"],
                "rix_score": readability_data["rix"]["score"],
                "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
                "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"],
                "user_context": request.user_context
            })
            logger.info("Recommendations generated", count=len(recommendations))
            
            # Add recommendations to readability data
            readability_data["recommendations"] = recommendations
            
            # Remove word analysis if not requested (to reduce response size)
            if not request.include_word_analysis:
                text_analysis_data.pop("word_analysis", None)
            
            # Remove sentence analysis if not requested
            if not request.include_sentence_analysis:
                text_analysis_data.pop("sentence_analysis", None)
            
            # Calculate processing time
            processing_time_ms = round((time.time() - start_time) * 1000, 2)
            
            # Prepare final result
            result = {
                "readability": readability_data,
                "text_analysis": text_analysis_data,
                "processing_time_ms": processing_time_ms,
                "cached": False
            }
            
            # Cache the result with adaptive TTL based on text size
            cache_ttl = get_cache_ttl(text)
            await set_in_cache(cache_key, json.dumps(result), cache_ttl)
            
            # Publish to RabbitMQ if available
            try:
                # Create message for RabbitMQ
                rabbitmq_result = result.copy()
                rabbitmq_result["timestamp"] = time.time()
                
                # Publish to RabbitMQ
                await rabbitmq_adapter.publish(
                    message=rabbitmq_result,
                    priority=1
                )
            except Exception as e:
                # Log error but don't fail the request
                logger.warning("Failed to publish to RabbitMQ", error=str(e))
            
            return result
                
        except Exception as e:
            ERROR_COUNT.labels(endpoint="/analyze", error_type="processing_error").inc()
            logger.error("Error analyzing text", error=str(e))
            raise HTTPException(status_code=500, detail=f"Error analyzing text: {str(e)}")

@app.post("/analyze/batch", response_model=List[Dict[str, Any]])
async def analyze_texts_batch(request: BatchTextRequest, background_tasks: BackgroundTasks):
    """
    Analyze multiple texts in batch mode for efficiency.
    
    Args:
        request: BatchTextRequest with list of texts to analyze
        background_tasks: FastAPI BackgroundTasks
        
    Returns:
        List of analysis results or task IDs for background processing
    """
    REQUEST_COUNT.labels(endpoint="/analyze/batch", method="POST").inc()
    
    with PROCESSING_TIME.labels(endpoint="/analyze/batch").time():
        start_time = time.time()
        
        try:
            if not request.texts:
                ERROR_COUNT.labels(endpoint="/analyze/batch", error_type="empty_batch").inc()
                raise HTTPException(status_code=400, detail="No texts provided in batch")
            
            results = []
            background_tasks_count = 0
            
            for text_item in request.texts:
                text = text_item.get('text', '').strip()
                if not text:
                    results.append({"error": "Empty text", "status": "failed"})
                    continue
                
                user_context = text_item.get('user_context')
                
                # Generate cache key
                cache_key = generate_cache_key(
                    text,
                    include_word_analysis=request.include_word_analysis,
                    include_sentence_analysis=request.include_sentence_analysis
                )
                
                # Try to get from cache
                cached_result = await get_from_cache(cache_key)
                if cached_result:
                    CACHE_HITS.labels(endpoint="/analyze/batch").inc()
                    result = json.loads(cached_result)
                    result["cached"] = True
                    results.append(result)
                    continue
                
                CACHE_MISSES.labels(endpoint="/analyze/batch").inc()
                
                # For large texts, process in background
                if len(text) > BACKGROUND_PROCESSING_THRESHOLD:
                    task_id = f"task-{hashlib.md5(text.encode('utf-8')).hexdigest()[:10]}-{int(time.time())}"
                    task_status_key = f"task_status:{task_id}"
                    await set_in_cache(task_status_key, json.dumps({
                        "status": "processing",
                        "created": time.time()
                    }), 3600)
                    
                    background_tasks.add_task(
                        process_text_analysis_background,
                        task_id=task_id,
                        text=text,
                        include_word_analysis=request.include_word_analysis,
                        include_sentence_analysis=request.include_sentence_analysis,
                        cache_key=cache_key,
                        user_context=user_context
                    )
                    
                    background_tasks_count += 1
                    results.append({
                        "task_id": task_id,
                        "status": "processing",
                        "polling_endpoint": f"/task/{task_id}",
                        "estimated_completion_seconds": max(5, len(text) // 10000)
                    })
                else:
                    # For smaller texts, process immediately
                    word_count = len(text.split())
                    WORD_COUNT_GAUGE.set(word_count)
                    
                    # Get readability metrics
                    readability_data = ReadabilityService.get_readability(text)
                    
                    # Get text analysis
                    text_analysis_data = TextAnalysisService.analyze_text(text)
                    
                    # Generate recommendations
                    recommender = get_recommender()
                    recommendations = recommender.generate({
                        "lix_score": readability_data["lix"]["score"],
                        "rix_score": readability_data["rix"]["score"],
                        "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
                        "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"],
                        "user_context": user_context
                    })
                    
                    readability_data["recommendations"] = recommendations
                    
                    if not request.include_word_analysis:
                        text_analysis_data.pop("word_analysis", None)
                    
                    if not request.include_sentence_analysis:
                        text_analysis_data.pop("sentence_analysis", None)
                    
                    # Calculate processing time
                    processing_time_ms = round((time.time() - start_time) * 1000, 2)
                    
                    result = {
                        "readability": readability_data,
                        "text_analysis": text_analysis_data,
                        "processing_time_ms": processing_time_ms,
                        "cached": False
                    }
                    
                    # Cache the result
                    cache_ttl = get_cache_ttl(text)
                    await set_in_cache(cache_key, json.dumps(result), cache_ttl)
                    results.append(result)
            
            # Return summary with batch results
            return {
                "results": results,
                "total_processed": len(results),
                "background_tasks": background_tasks_count,
                "batch_processing_time_ms": round((time.time() - start_time) * 1000, 2)
            }
                
        except Exception as e:
            ERROR_COUNT.labels(endpoint="/analyze/batch", error_type="processing_error").inc()
            logger.error("Error analyzing batch texts", error=str(e))
            raise HTTPException(status_code=500, detail=f"Error analyzing batch texts: {str(e)}")

# Add a background task processor function
async def process_text_analysis_background(task_id: str, text: str, 
                                       include_word_analysis: bool,
                                       include_sentence_analysis: bool,
                                       cache_key: str,
                                       user_context: dict = None):
    """Process text analysis in the background for large texts."""
    start_time = time.time()
    try:
        # Update task status
        task_status_key = f"task_status:{task_id}"
        
        # Get readability metrics
        readability_data = ReadabilityService.get_readability(text)
        
        # Get text analysis
        text_analysis_data = TextAnalysisService.analyze_text(text)
        
        # Generate recommendations
        recommender = get_recommender()
        recommendations = recommender.generate({
            "lix_score": readability_data["lix"]["score"],
            "rix_score": readability_data["rix"]["score"],
            "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
            "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"],
            "user_context": user_context
        })
        
        # Add recommendations to readability data
        readability_data["recommendations"] = recommendations
        
        # Remove data if not requested
        if not include_word_analysis:
            text_analysis_data.pop("word_analysis", None)
            
        if not include_sentence_analysis:
            text_analysis_data.pop("sentence_analysis", None)
        
        # Calculate processing time
        processing_time_ms = round((time.time() - start_time) * 1000, 2)
        
        # Prepare final result
        result = {
            "readability": readability_data,
            "text_analysis": text_analysis_data,
            "processing_time_ms": processing_time_ms,
            "cached": False
        }
        
        # Store result in Redis with the original cache key
        cache_ttl = get_cache_ttl(text)
        await set_in_cache(cache_key, json.dumps(result), cache_ttl)
        
        # Update task status to completed
        await set_in_cache(task_status_key, json.dumps({
            "status": "completed",
            "created": time.time(),
            "completed": time.time(),
            "result": result
        }), 3600)  # 1 hour TTL
        
    except Exception as e:
        logger.error(f"Background processing error for task {task_id}", error=str(e))
        # Update task status to failed
        await set_in_cache(
            task_status_key, 
            json.dumps({
                "status": "failed",
                "error": str(e),
                "created": time.time(),
                "completed": time.time()
            }), 
            3600
        )

# Add an endpoint to check task status
@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Check the status of a background processing task."""
    task_status_key = f"task_status:{task_id}"
    status_data = await get_from_cache(task_status_key)
    
    if not status_data:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    status = json.loads(status_data)
    
    if status["status"] == "completed" and "result" in status:
        # Return the completed result
        return status["result"]
    
    # Return the current status
    return status

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint that verifies Redis, RabbitMQ, and system health."""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "services": {
            "api": "up",
            "redis": "unknown",
            "rabbitmq": "unknown",
            "redis_pubsub": "unknown"
        },
        "system": {
            "cpu_percent": 0,
            "memory_percent": 0,
            "disk_percent": 0
        },
        "metrics": {
            "enable_metrics": ENABLE_METRICS,
            "cache_hit_ratio": 0
        }
    }
    
    # Check Redis connection
    try:
        async with redis.Redis(connection_pool=redis_pool, socket_timeout=2.0) as r:
            await r.ping()
            health_status["services"]["redis"] = "up"
            
            # Check Redis PubSub status
            if pubsub_handler.running:
                health_status["services"]["redis_pubsub"] = "up"
            
            # Get cache stats if available
            if ENABLE_METRICS:
                cache_hits = 0
                cache_misses = 0
                try:
                    for sample in CACHE_HITS._samples():
                        cache_hits += sample[2]
                    for sample in CACHE_MISSES._samples():
                        cache_misses += sample[2]
                        
                    total_cache_requests = cache_hits + cache_misses
                    health_status["metrics"]["cache_hit_ratio"] = cache_hits / total_cache_requests if total_cache_requests > 0 else 0
                except Exception as metric_error:
                    logger.warning("Error fetching cache metrics", error=str(metric_error))
    except Exception as e:
        health_status["services"]["redis"] = "down"
        health_status["status"] = "degraded"
        logger.warning("Redis health check failed", error=str(e))
    
    # Check RabbitMQ connection
    try:
        connected = await rabbitmq_adapter.connect()
        if connected:
            health_status["services"]["rabbitmq"] = "up"
        else:
            health_status["services"]["rabbitmq"] = "down"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["rabbitmq"] = "down"
        health_status["status"] = "degraded"
        logger.warning("RabbitMQ health check failed", error=str(e))
    
    # Get system stats
    try:
        # Update system metrics in Prometheus
        if ENABLE_METRICS:
            memory = psutil.virtual_memory()
            SYSTEM_MEMORY.labels(type="total").set(memory.total)
            SYSTEM_MEMORY.labels(type="available").set(memory.available)
            SYSTEM_MEMORY.labels(type="used").set(memory.used)
            
            # Get per-CPU stats
            for i, cpu_percent in enumerate(psutil.cpu_percent(percpu=True)):
                SYSTEM_CPU.labels(cpu=f"cpu{i}").set(cpu_percent)
        
        # Add system info to response
        health_status["system"]["cpu_percent"] = psutil.cpu_percent()
        health_status["system"]["memory_percent"] = psutil.virtual_memory().percent
        health_status["system"]["disk_percent"] = psutil.disk_usage('/').percent
    except Exception as e:
        logger.warning("System stats check failed", error=str(e))
        health_status["system"]["error"] = str(e)
    
    return health_status

# WebSocket endpoint
@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    """
    WebSocket endpoint for real-time text analysis during typing.
    Uses adaptive throttling and incremental analysis for performance.
    """
    await manager.connect(websocket)
    client_id = id(websocket)
    ACTIVE_WEBSOCKET_CONNECTIONS.inc()
    
    # Track the last processing time to implement adaptive throttling
    last_process_time = time.time()
    last_text = ""
    last_text_length = 0
    last_word_count = 0
    debounce_time = 0.2  # Start with 200ms debounce
    min_debounce_time = 0.1  # Minimum 100ms between analyses
    max_debounce_time = 0.8  # Reduced from 1.0s to 0.8s for better responsiveness
    
    # Use a separate mini-cache for each websocket connection
    connection_cache = {}
    
    try:
        logger.info(f"WebSocket client connected", client_id=client_id)
        
        while True:
            # Wait for the next message
            message_json = await websocket.receive_text()
            
            try:
                message = json.loads(message_json)
                text = message.get("text", "").strip()
                include_word_analysis = message.get("include_word_analysis", False)
                include_sentence_analysis = message.get("include_sentence_analysis", False)
                
                # Skip empty text immediately
                if not text:
                    await websocket.send_json({"error": "No text provided"})
                    continue
                
                # Fast path: if text is identical, use cached result
                if text == last_text:
                    continue
                
                # Adaptive throttling based on text similarity and system load
                current_time = time.time()
                time_since_last = current_time - last_process_time
                text_length = len(text)
                
                # Skip processing if not enough time has passed (debouncing)
                # But allow faster updates when text length changes significantly
                text_length_change_ratio = abs(text_length - last_text_length) / max(1, last_text_length)
                significant_change = text_length_change_ratio > 0.15  # 15% change in length
                
                if time_since_last < debounce_time and not significant_change:
                    continue
                
                # Adjust debounce time based on system load
                cpu_load = psutil.cpu_percent(interval=None) / 100
                memory_use = psutil.virtual_memory().percent / 100
                system_load = (cpu_load + memory_use) / 2
                
                # Adaptive debounce based on load and text length
                if system_load > 0.8:  # High load
                    debounce_time = max_debounce_time
                elif system_load > 0.5:  # Medium load
                    debounce_time = min_debounce_time + (max_debounce_time - min_debounce_time) * (system_load - 0.5) / 0.3
                else:  # Low load
                    debounce_time = min_debounce_time
                
                # Further adjust debounce time based on text length
                if text_length > 5000:
                    debounce_time *= 1.2  # Increased from 1.5 to reduce latency
                
                # Generate cache key
                cache_key = f"{text[:50]}_{text_length}_{include_word_analysis}_{include_sentence_analysis}"
                
                # Check connection-specific cache first
                if cache_key in connection_cache:
                    result = connection_cache[cache_key]
                    await websocket.send_json(result)
                    
                    # Update tracking variables
                    last_process_time = current_time
                    last_text = text
                    last_text_length = text_length
                    continue
                    
                # Check global cache
                global_cache_key = generate_cache_key(text, include_word_analysis, include_sentence_analysis)
                cached_result = await get_from_cache(global_cache_key)
                
                if cached_result:
                    WEBSOCKET_CACHE_HITS.inc()
                    result = json.loads(cached_result)
                    result["cached"] = True
                    
                    # Store in connection cache
                    connection_cache[cache_key] = result
                    
                    # Manage connection cache size
                    if len(connection_cache) > 20:  # Keep connection cache small
                        connection_cache.clear()  # Simple approach: just clear it when it gets too big
                        
                    await websocket.send_json(result)
                    
                    # Update tracking variables
                    last_process_time = current_time
                    last_text = text
                    last_text_length = text_length
                    continue
                
                WEBSOCKET_CACHE_MISSES.inc()
                
                # Start timing the processing
                start_time = time.time()
                
                # For longer texts or during frequent updates, use incremental analysis
                is_incremental = len(text) > 1000 or time_since_last < 0.5
                
                if is_incremental:
                    # For real-time typing, just calculate basic metrics first
                    # This gives quick feedback to the user
                    readability_data = ReadabilityService.get_readability(text)
                    
                    # Send fast initial result
                    initial_result = {
                        "readability": readability_data,
                        "partial": True,
                        "cached": False
                    }
                    await websocket.send_json(initial_result)
                    
                    # For very long texts, process in background and return
                    if len(text) > 10000:
                        # Don't block the WebSocket with detailed analysis of very long text
                        # Let the user continue typing, and we'll catch up later
                        asyncio.create_task(process_detailed_analysis(
                            text, 
                            include_word_analysis,
                            include_sentence_analysis,
                            global_cache_key
                        ))
                        
                        # Update tracking variables
                        last_process_time = current_time
                        last_text = text  
                        last_text_length = text_length
                        continue
                
                # For smaller texts or after sufficient delay, process normally
                # Use simpler text_analysis for WebSockets to reduce computation
                words = ReadabilityService._extract_words(text)
                word_count = len(words)
                
                # Only do expensive analysis when needed
                if word_count > last_word_count * 1.1 or word_count < last_word_count * 0.9:
                    # Full text analysis may be expensive, so only do it when:
                    # 1. The text has significantly changed in length
                    # 2. Or we have enough time since last analysis
                    if significant_change or time_since_last > 0.5:
                        text_analysis_data = TextAnalysisService.analyze_text(text, 
                                                                          simple_mode=True)
                    else:
                        # Use cached analysis or simplified version
                        text_analysis_data = TextAnalysisService.get_basic_statistics(text)
                else:
                    # Use cached analysis or simplified version
                    text_analysis_data = TextAnalysisService.get_basic_statistics(text)
                
                # Filter analysis data based on client request
                if not include_word_analysis:
                    text_analysis_data.pop("word_analysis", None)
                
                if not include_sentence_analysis:
                    text_analysis_data.pop("sentence_analysis", None)
                
                # Generate recommendations only for:
                # 1. Texts longer than a minimum length
                # 2. After a certain pause in typing (to not interrupt the user)
                recommendations = []
                if word_count > 15 and time_since_last > 0.7:
                    # Get readability data (might already be calculated above)
                    if 'readability_data' not in locals():
                        readability_data = ReadabilityService.get_readability(text)
                        
                    # Generate recommendations
                    recommender = get_recommender()
                    recommendations = recommender.generate({
                        "lix_score": readability_data["lix"]["score"],
                        "rix_score": readability_data["rix"]["score"],
                        "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
                        "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"],
                        "user_context": message.get("user_context", {})
                    }, simplified=True)  # Use simplified mode for WebSockets
                
                # Add recommendations to readability data
                if 'readability_data' not in locals():
                    readability_data = ReadabilityService.get_readability(text)
                readability_data["recommendations"] = recommendations
                
                # Calculate processing time
                processing_time_ms = round((time.time() - start_time) * 1000, 2)
                WEBSOCKET_PROCESSING_TIME.observe(processing_time_ms / 1000)  # Convert to seconds for histogram
                
                # Prepare final result
                result = {
                    "readability": readability_data,
                    "text_analysis": text_analysis_data,
                    "processing_time_ms": processing_time_ms,
                    "cached": False,
                    "partial": False
                }
                
                # Cache the result with adaptive TTL based on text size
                cache_ttl = get_cache_ttl(text)
                await set_in_cache(global_cache_key, json.dumps(result), cache_ttl)
                
                # Store in connection cache
                connection_cache[cache_key] = result
                
                # Send the result back to the client
                await websocket.send_json(result)
                
                # Update tracking variables
                last_process_time = time.time()
                last_text = text
                last_text_length = text_length
                last_word_count = word_count
                
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON message"})
            except Exception as e:
                logger.error("Error processing WebSocket message", error=str(e))
                await websocket.send_json({"error": f"Error processing text: {str(e)}"})
                ERROR_COUNT.labels(endpoint="/ws/analyze", error_type="processing_error").inc()
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        ACTIVE_WEBSOCKET_CONNECTIONS.dec()
        logger.info(f"WebSocket client disconnected", client_id=client_id)
    except Exception as e:
        manager.disconnect(websocket)
        ACTIVE_WEBSOCKET_CONNECTIONS.dec()
        logger.error("WebSocket connection error", error=str(e), client_id=client_id)
        ERROR_COUNT.labels(endpoint="/ws/analyze", error_type="connection_error").inc()

# Helper function for background processing of detailed analysis
async def process_detailed_analysis(text: str, include_word_analysis: bool, 
                               include_sentence_analysis: bool, cache_key: str):
    """Process detailed text analysis in the background for WebSocket connections"""
    try:
        # Get readability metrics
        readability_data = ReadabilityService.get_readability(text)
        
        # Full text analysis
        text_analysis_data = TextAnalysisService.analyze_text(text)
        
        # Filter out data based on flags
        if not include_word_analysis:
            text_analysis_data.pop("word_analysis", None)
            
        if not include_sentence_analysis:
            text_analysis_data.pop("sentence_analysis", None)
        
        # Generate recommendations
        recommender = get_recommender()
        recommendations = recommender.generate({
            "lix_score": readability_data["lix"]["score"],
            "rix_score": readability_data["rix"]["score"],
            "avg_sentence_length": text_analysis_data["statistics"]["avg_sentence_length"],
            "long_words_percentage": text_analysis_data["statistics"]["long_words_percentage"]
        })
        
        # Add recommendations to data
        readability_data["recommendations"] = recommendations
        
        # Prepare final result
        result = {
            "readability": readability_data,
            "text_analysis": text_analysis_data,
            "cached": False,
            "partial": False
        }
        
        # Cache the result with adaptive TTL
        cache_ttl = get_cache_ttl(text)
        await set_in_cache(cache_key, json.dumps(result), cache_ttl)
    except Exception as e:
        logger.error(f"Background analysis error: {str(e)}")
        # We don't need to propagate this error as it's a background task

# SSE endpoint for real-time text analysis
@app.get("/sse")
async def sse_endpoint(request: Request):
    """SSE endpoint for streaming text analysis updates."""
    async def event_generator():
        # Set up RabbitMQ consumer
        consumer = await rabbitmq_adapter.create_consumer(
            queue_name=RABBITMQ_QUEUE_NAME,
            exchange_name=RABBITMQ_EXCHANGE,
            routing_key=RABBITMQ_ROUTING_KEY
        )
        
        try:
            async for message in consumer:
                if await request.is_disconnected():
                    break
                
                # Parse the message and yield it as an SSE event
                try:
                    # Message from RabbitMQ is already in JSON format
                    data = message
                    yield {
                        "event": "analysis",
                        "id": str(time.time()),
                        "data": json.dumps(data)
                    }
                except Exception as e:
                    yield {
                        "event": "error",
                        "id": str(time.time()),
                        "data": json.dumps({"error": str(e)})
                    }
                    ERROR_COUNT.labels(endpoint="/sse", error_type="processing").inc()
        except Exception as e:
            logger.error("SSE RabbitMQ consumer error", error=str(e))
            yield {
                "event": "error",
                "id": str(time.time()),
                "data": json.dumps({"error": f"SSE connection error: {str(e)}"})
            }
    
    return EventSourceResponse(event_generator())

@app.post('/analyze/stream')
async def stream_analysis(request: TextRequest):
    """
    Stream text analysis results as they become available.
    
    This endpoint processes text incrementally, returning partial results
    as soon as they become available. Useful for analyzing large texts
    without waiting for the complete analysis.
    """
    REQUEST_COUNT.labels(endpoint='/analyze/stream', method='POST').inc()
    start_time = time.time()
    
    try:
        text = request.text.strip()
        if not text:
            ERROR_COUNT.labels(endpoint="/analyze/stream", error_type="empty_text").inc()
            return JSONResponse(
                status_code=400,
                content={"error": "No text provided"}
            )
        
        async def generate_incremental_results():
            try:
                # Split text into paragraphs for incremental processing
                paragraphs = []
                # Simple paragraph splitting by double newlines
                for p in text.split('\n\n'):
                    if p.strip():  # Skip empty paragraphs
                        paragraphs.append(p.strip())
                
                if not paragraphs:
                    paragraphs = [text]  # If no paragraph breaks, treat as a single paragraph
                
                # Process in chunks of paragraphs
                total_text = ''
                chunk_size = min(5, max(1, len(paragraphs) // 10))  # Adaptive chunk size
                total_chunks = (len(paragraphs) + chunk_size - 1) // chunk_size
                
                for i in range(0, len(paragraphs), chunk_size):
                    # Get current chunk of paragraphs
                    current_paragraphs = paragraphs[i:i+chunk_size]
                    chunk = ' '.join(current_paragraphs)
                    total_text += (' ' if total_text else '') + chunk
                    
                    # Skip empty chunks
                    if not chunk.strip():
                        continue
                    
                    # Create a progress value
                    progress = min(100, int((i + chunk_size) / len(paragraphs) * 100))
                    chunk_number = (i // chunk_size) + 1
                    
                    try:
                        # Calculate basic metrics for the accumulated text
                        readability_data = ReadabilityService.get_readability(total_text)
                        
                        # Create result with basic metrics only
                        result = {
                            'chunk': chunk_number,
                            'total_chunks': total_chunks,
                            'progress': progress,
                            'readability': readability_data,
                            'is_final': (i + chunk_size) >= len(paragraphs),
                            'timestamp': time.time()
                        }
                        
                        # For last chunk or every 3rd chunk, include more detailed analysis
                        detailed_analysis = ((i + chunk_size) >= len(paragraphs)) or (chunk_number % 3 == 0)
                        
                        if detailed_analysis:
                            # Add text analysis for accumulated text
                            text_analysis_data = TextAnalysisService.analyze_text(
                                total_text,
                                simple_mode=True  # Use simple mode for streaming
                            )
                            
                            # Filter analysis data based on client request
                            if not request.include_word_analysis:
                                text_analysis_data.pop("word_analysis", None)
                            
                            if not request.include_sentence_analysis:
                                text_analysis_data.pop("sentence_analysis", None)
                                
                            result['text_analysis'] = text_analysis_data
                            
                            # Generate recommendations for the final chunk or major milestones
                            if (i + chunk_size) >= len(paragraphs) or progress % 50 == 0:
                                recommender = get_recommender()
                                statistics = text_analysis_data.get("statistics", {})
                                recommendations = recommender.generate({
                                    "lix_score": readability_data["lix"]["score"],
                                    "rix_score": readability_data["rix"]["score"],
                                    "avg_sentence_length": statistics.get("avg_sentence_length", 0),
                                    "long_words_percentage": statistics.get("long_words_percentage", 0),
                                    "user_context": request.user_context
                                }, simplified=True)
                                
                                readability_data["recommendations"] = recommendations
                                
                        # Yield result as SSE event
                        yield json.dumps({'data': result})
                        
                    except Exception as chunk_error:
                        logger.error(f"Error processing chunk {chunk_number}", error=str(chunk_error))
                        yield json.dumps({
                            'error': str(chunk_error),
                            'chunk': chunk_number,
                            'total_chunks': total_chunks,
                            'progress': progress,
                            'is_final': (i + chunk_size) >= len(paragraphs)
                        })
                    
                    # Small delay to prevent overwhelming the client and server
                    await asyncio.sleep(0.05)
                
                # Final processing time
                processing_time = time.time() - start_time
                yield json.dumps({
                    'data': {
                        'processing_completed': True,
                        'processing_time_seconds': round(processing_time, 2)
                    }
                })
                
                # Track metrics for completed request
                REQUEST_LATENCY.labels(endpoint='/analyze/stream', method='POST').observe(processing_time)
                
            except Exception as gen_error:
                logger.error("Error in stream generator", error=str(gen_error))
                yield json.dumps({'error': f"Stream processing error: {str(gen_error)}"})
                ERROR_COUNT.labels(endpoint="/analyze/stream", error_type="generator_error").inc()
        
        return EventSourceResponse(
            generate_incremental_results(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
        )
        
    except Exception as e:
        logger.error("Error initializing stream analysis", error=str(e))
        ERROR_COUNT.labels(endpoint="/analyze/stream", error_type="initialization_error").inc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Error initializing stream analysis: {str(e)}"}
        )

# Helper function to delete from cache
async def delete_from_cache(key):
    """Delete a key from Redis cache"""
    try:
        async with get_redis_pool() as redis:
            await redis.delete(key)
    except Exception as e:
        logger.error("Error deleting from cache", error=str(e))
        return False
    return True

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8012, reload=True)