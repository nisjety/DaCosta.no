"""
Structured logging utility for LixService.
"""
import os
import sys
import logging
import structlog

def get_logger(name=None):
    """Configure and return a structured logger."""
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Get logger
    logger = structlog.get_logger(name)
    
    # Set log level
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level),
        stream=sys.stdout,
    )
    
    return logger