"""
Circuit breaker implementation for resilient external service communication.
This pattern prevents cascading failures by failing fast when external services are unhealthy.
"""
import time
import asyncio
from enum import Enum
import logging
import functools
from typing import Callable, Any, Optional, TypeVar, cast

# Create typed variables for better typing support
T = TypeVar('T')
F = TypeVar('F', bound=Callable[..., Any])

class CircuitState(Enum):
    """Possible states of the circuit breaker."""
    CLOSED = 'CLOSED'  # Normal operation, requests pass through
    OPEN = 'OPEN'      # Failing fast, rejecting all requests
    HALF_OPEN = 'HALF_OPEN'  # Testing if service is back by allowing limited requests
    
class CircuitBreaker:
    """
    Implements the circuit breaker pattern for more resilient service communication.
    
    When a service becomes unresponsive, the circuit opens to prevent cascading failures,
    and automatically tests service availability after a recovery timeout.
    """
    
    def __init__(
        self, 
        name: str, 
        max_failures: int = 5, 
        reset_timeout: int = 60, 
        failure_threshold_percentage: float = 50
    ):
        """
        Initialize a new circuit breaker.
        
        Args:
            name: Identifier for this circuit breaker
            max_failures: Number of consecutive failures before opening circuit
            reset_timeout: Seconds to wait before testing service recovery
            failure_threshold_percentage: Percentage of failed requests to trigger open state
        """
        self._name = name
        self._max_failures = max_failures
        self._reset_timeout = reset_timeout
        self._failure_threshold = failure_threshold_percentage
        
        # Internal state
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0
        self._request_count = 0
        self._success_count = 0
        
        self._logger = logging.getLogger(f'circuit_breaker.{name}')
        
    @property
    def state(self) -> CircuitState:
        """Get the current state of the circuit breaker."""
        # Check if it's time to attempt recovery
        if (self._state == CircuitState.OPEN and 
            time.time() - self._last_failure_time > self._reset_timeout):
            self._state = CircuitState.HALF_OPEN
            self._logger.info(f"Circuit {self._name} switched to HALF_OPEN state")
        return self._state
        
    def success(self) -> None:
        """Report a successful operation, potentially closing the circuit."""
        if self._state == CircuitState.HALF_OPEN:
            self._failure_count = 0
            self._state = CircuitState.CLOSED
            self._request_count = 0  
            self._success_count = 0
            self._logger.info(f"Circuit {self._name} switched back to CLOSED state")
        
        if self._state == CircuitState.CLOSED:
            self._success_count += 1
            self._request_count += 1
    
    def failure(self) -> None:
        """Report a failed operation, potentially opening the circuit."""
        self._last_failure_time = time.time()
        self._failure_count += 1
        self._request_count += 1
        
        # Check if we should open the circuit
        if self._state == CircuitState.CLOSED:
            if self._failure_count >= self._max_failures:
                self._state = CircuitState.OPEN
                self._logger.warning(f"Circuit {self._name} OPENED after {self._failure_count} failures")
            elif (self._request_count > 10 and 
                  (100 * (self._request_count - self._success_count) / self._request_count) > self._failure_threshold):
                self._state = CircuitState.OPEN
                self._logger.warning(f"Circuit {self._name} OPENED due to high failure rate")
                
        elif self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            self._logger.warning(f"Circuit {self._name} reopened after test failure in HALF_OPEN state")
    
    def reset(self) -> None:
        """Reset the circuit breaker to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._request_count = 0
        self._success_count = 0
        self._logger.info(f"Circuit {self._name} manually reset to CLOSED state")
    
    def can_execute(self) -> bool:
        """Check if requests are allowed through the circuit."""
        return self.state != CircuitState.OPEN

    def __call__(self, func: F) -> F:
        """
        Decorator to wrap functions with circuit breaker pattern.
        
        Usage:
            @redis_circuit
            async def get_from_redis(key):
                return await redis_client.get(key)
        """
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            if not self.can_execute():
                raise CircuitBreakerError(f"Circuit {self._name} is OPEN")
            
            try:
                result = await func(*args, **kwargs)
                self.success()
                return result
            except Exception as e:
                self.failure()
                raise CircuitBreakerError(f"Operation failed: {str(e)}") from e
                
        return cast(F, wrapper)
        
class CircuitBreakerError(Exception):
    """Error raised when a circuit breaker prevents an operation."""
    pass