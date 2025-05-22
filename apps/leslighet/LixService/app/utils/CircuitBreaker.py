import asyncio
import time
import logging
import structlog

logger = structlog.get_logger()

class CircuitBreaker:
    """
    Circuit breaker for external service calls.
    
    Implements the circuit breaker pattern to prevent repeated calls to failing services.
    Automatically switches between closed, open, and half-open states based on failures.
    """
    
    def __init__(self, name, max_failures=5, reset_timeout=60):
        """
        Initialize a new circuit breaker.
        
        Args:
            name: Name of the service being protected
            max_failures: Maximum number of failures before opening the circuit
            reset_timeout: Time in seconds to wait before trying again (half-open state)
        """
        self.name = name
        self.max_failures = max_failures
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.last_failure = 0
        self.state = "closed"  # closed, open, half-open
        self._lock = asyncio.Lock()
        
    async def execute(self, func, *args, fallback=None, **kwargs):
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Async function to execute
            fallback: Value to return if circuit is open or execution fails
            *args, **kwargs: Arguments to pass to the function
            
        Returns:
            Result of func or fallback value
        """
        async with self._lock:
            # Check if circuit is open
            if self.state == "open":
                if time.time() - self.last_failure > self.reset_timeout:
                    self.state = "half-open"
                    logger.info(f"Circuit {self.name} changed to half-open")
                else:
                    logger.warning(f"Circuit {self.name} is open, using fallback")
                    return fallback
            
        try:
            result = await func(*args, **kwargs)
            
            # If successful and in half-open state, reset circuit
            if self.state == "half-open":
                async with self._lock:
                    self.failures = 0
                    self.state = "closed"
                    logger.info(f"Circuit {self.name} closed after successful execution")
            
            return result
            
        except Exception as e:
            async with self._lock:
                self.failures += 1
                self.last_failure = time.time()
                
                # Open circuit if failures exceed threshold
                if self.failures >= self.max_failures:
                    self.state = "open"
                    logger.warning(f"Circuit {self.name} opened after {self.failures} failures")
                
            logger.error(f"{self.name} operation failed: {str(e)}")
            return fallback