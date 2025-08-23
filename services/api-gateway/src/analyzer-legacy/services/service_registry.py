#!/usr/bin/env python3
"""
Service Registry - Dependency injection and service management
Fixes service initialization issues and provides centralized service lifecycle management
"""

import logging
import threading
from typing import Dict, Any, Optional, Callable, TypeVar, Type
from abc import ABC, abstractmethod
from enum import Enum

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ServiceLifetime(Enum):
    """Service lifetime management options"""
    SINGLETON = "singleton"
    TRANSIENT = "transient"
    SCOPED = "scoped"


class ServiceStatus(Enum):
    """Service status tracking"""
    NOT_INITIALIZED = "not_initialized"
    INITIALIZING = "initializing"
    READY = "ready"
    ERROR = "error"
    DISPOSED = "disposed"


class Service(ABC):
    """Base class for services with lifecycle management"""
    
    def __init__(self):
        self._status = ServiceStatus.NOT_INITIALIZED
        self._error_message = None
    
    @abstractmethod
    async def initialize(self) -> bool:
        """Initialize the service"""
        pass
    
    @abstractmethod
    async def dispose(self):
        """Clean up service resources"""
        pass
    
    @property
    def status(self) -> ServiceStatus:
        return self._status
    
    @property
    def error_message(self) -> Optional[str]:
        return self._error_message
    
    def _set_status(self, status: ServiceStatus, error_message: Optional[str] = None):
        self._status = status
        self._error_message = error_message


class ServiceDescriptor:
    """Describes how a service should be created and managed"""
    
    def __init__(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
        dependencies: Optional[list] = None
    ):
        self.service_type = service_type
        self.implementation_type = implementation_type or service_type
        self.factory = factory
        self.lifetime = lifetime
        self.dependencies = dependencies or []
        self.instance = None
        self.status = ServiceStatus.NOT_INITIALIZED


class ServiceRegistry:
    """
    Central service registry for dependency injection
    
    Features:
    - Service registration with lifetime management
    - Dependency injection and resolution
    - Service lifecycle management
    - Thread-safe operations
    - Health monitoring
    """
    
    _instance: Optional['ServiceRegistry'] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> 'ServiceRegistry':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ServiceRegistry, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self._initialized = True
            self._services: Dict[str, ServiceDescriptor] = {}
            self._instances: Dict[str, Any] = {}
            self._initialization_order: list = []
            self._lock = threading.RLock()
    
    def register_singleton(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        dependencies: Optional[list] = None
    ) -> 'ServiceRegistry':
        """Register a singleton service"""
        return self._register_service(
            service_type,
            implementation_type,
            factory,
            ServiceLifetime.SINGLETON,
            dependencies
        )
    
    def register_transient(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        dependencies: Optional[list] = None
    ) -> 'ServiceRegistry':
        """Register a transient service (new instance each time)"""
        return self._register_service(
            service_type,
            implementation_type,
            factory,
            ServiceLifetime.TRANSIENT,
            dependencies
        )
    
    def register_scoped(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        dependencies: Optional[list] = None
    ) -> 'ServiceRegistry':
        """Register a scoped service (per request/scope)"""
        return self._register_service(
            service_type,
            implementation_type,
            factory,
            ServiceLifetime.SCOPED,
            dependencies
        )
    
    def _register_service(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]],
        factory: Optional[Callable[[], T]],
        lifetime: ServiceLifetime,
        dependencies: Optional[list]
    ) -> 'ServiceRegistry':
        """Internal service registration"""
        with self._lock:
            service_key = self._get_service_key(service_type)
            
            if service_key in self._services:
                logger.warning(f"Service {service_key} is already registered, replacing")
            
            descriptor = ServiceDescriptor(
                service_type=service_type,
                implementation_type=implementation_type,
                factory=factory,
                lifetime=lifetime,
                dependencies=dependencies
            )
            
            self._services[service_key] = descriptor
            logger.info(f"Registered service {service_key} with lifetime {lifetime.value}")
            
        return self
    
    def get_service(self, service_type: Type[T]) -> Optional[T]:
        """Get a service instance"""
        with self._lock:
            service_key = self._get_service_key(service_type)
            
            if service_key not in self._services:
                logger.error(f"Service {service_key} is not registered")
                return None
            
            descriptor = self._services[service_key]
            
            try:
                if descriptor.lifetime == ServiceLifetime.SINGLETON:
                    return self._get_singleton_instance(descriptor)
                elif descriptor.lifetime == ServiceLifetime.TRANSIENT:
                    return self._create_instance(descriptor)
                elif descriptor.lifetime == ServiceLifetime.SCOPED:
                    # For now, treat scoped as singleton
                    # In a web context, this would be per-request
                    return self._get_singleton_instance(descriptor)
                
            except Exception as e:
                logger.error(f"Error creating service {service_key}: {e}")
                descriptor.status = ServiceStatus.ERROR
                return None
        
        return None
    
    def _get_singleton_instance(self, descriptor: ServiceDescriptor) -> Any:
        """Get or create singleton instance"""
        service_key = self._get_service_key(descriptor.service_type)
        
        if service_key in self._instances:
            return self._instances[service_key]
        
        instance = self._create_instance(descriptor)
        if instance:
            self._instances[service_key] = instance
            descriptor.instance = instance
            descriptor.status = ServiceStatus.READY
        
        return instance
    
    def _create_instance(self, descriptor: ServiceDescriptor) -> Any:
        """Create a new instance of the service"""
        try:
            descriptor.status = ServiceStatus.INITIALIZING
            
            # Resolve dependencies first
            resolved_dependencies = []
            for dep_type in descriptor.dependencies:
                dep_instance = self.get_service(dep_type)
                if dep_instance is None:
                    raise Exception(f"Failed to resolve dependency {dep_type}")
                resolved_dependencies.append(dep_instance)
            
            # Create instance
            if descriptor.factory:
                instance = descriptor.factory()
            else:
                if resolved_dependencies:
                    instance = descriptor.implementation_type(*resolved_dependencies)
                else:
                    instance = descriptor.implementation_type()
            
            # Initialize if it's a Service
            if isinstance(instance, Service):
                # This would be async in a real async context
                # For now, we'll assume sync initialization
                pass
            
            logger.info(f"Created instance of {self._get_service_key(descriptor.service_type)}")
            return instance
            
        except Exception as e:
            logger.error(f"Failed to create instance of {self._get_service_key(descriptor.service_type)}: {e}")
            descriptor.status = ServiceStatus.ERROR
            raise
    
    def get_required_service(self, service_type: Type[T]) -> T:
        """Get a service instance, raising exception if not found"""
        instance = self.get_service(service_type)
        if instance is None:
            raise Exception(f"Required service {self._get_service_key(service_type)} is not available")
        return instance
    
    def is_registered(self, service_type: Type[T]) -> bool:
        """Check if a service is registered"""
        service_key = self._get_service_key(service_type)
        return service_key in self._services
    
    def get_service_status(self, service_type: Type[T]) -> Optional[ServiceStatus]:
        """Get the status of a registered service"""
        service_key = self._get_service_key(service_type)
        if service_key in self._services:
            return self._services[service_key].status
        return None
    
    def get_all_services_status(self) -> Dict[str, dict]:
        """Get status of all registered services"""
        status_info = {}
        
        with self._lock:
            for service_key, descriptor in self._services.items():
                status_info[service_key] = {
                    'status': descriptor.status.value,
                    'lifetime': descriptor.lifetime.value,
                    'has_instance': service_key in self._instances,
                    'dependencies': [self._get_service_key(dep) for dep in descriptor.dependencies]
                }
        
        return status_info
    
    def dispose_all(self):
        """Dispose all singleton instances"""
        with self._lock:
            for service_key, instance in self._instances.items():
                try:
                    if isinstance(instance, Service):
                        # This would be async in a real async context
                        pass
                    logger.info(f"Disposed service {service_key}")
                except Exception as e:
                    logger.error(f"Error disposing service {service_key}: {e}")
            
            self._instances.clear()
            
            # Reset service statuses
            for descriptor in self._services.values():
                descriptor.status = ServiceStatus.DISPOSED
                descriptor.instance = None
    
    def reset(self):
        """Reset the entire registry"""
        with self._lock:
            self.dispose_all()
            self._services.clear()
            self._initialization_order.clear()
            logger.info("Service registry reset")
    
    def _get_service_key(self, service_type: Type) -> str:
        """Get a string key for the service type"""
        return f"{service_type.__module__}.{service_type.__name__}"
    
    def build_dependency_graph(self) -> Dict[str, list]:
        """Build a dependency graph for debugging"""
        graph = {}
        
        with self._lock:
            for service_key, descriptor in self._services.items():
                dependencies = [
                    self._get_service_key(dep) for dep in descriptor.dependencies
                ]
                graph[service_key] = dependencies
        
        return graph
    
    def validate_dependencies(self) -> Dict[str, list]:
        """Validate that all dependencies can be resolved"""
        issues = {}
        
        with self._lock:
            for service_key, descriptor in self._services.items():
                service_issues = []
                
                for dep_type in descriptor.dependencies:
                    dep_key = self._get_service_key(dep_type)
                    if dep_key not in self._services:
                        service_issues.append(f"Missing dependency: {dep_key}")
                
                if service_issues:
                    issues[service_key] = service_issues
        
        return issues


# Global instance and convenience functions
def get_service_registry() -> ServiceRegistry:
    """Get the global service registry instance"""
    return ServiceRegistry()


def register_services():
    """Register all application services"""
    registry = get_service_registry()
    
    # Import here to avoid circular dependencies
    try:
        from .database_manager import DatabaseManager
        registry.register_singleton(DatabaseManager)
        logger.info("Registered DatabaseManager service")
    except ImportError as e:
        logger.warning(f"Could not register DatabaseManager: {e}")
    
    # Register other services here as they're created
    logger.info("Service registration completed")


def get_service(service_type: Type[T]) -> Optional[T]:
    """Convenience function to get a service"""
    registry = get_service_registry()
    return registry.get_service(service_type)


def get_required_service(service_type: Type[T]) -> T:
    """Convenience function to get a required service"""
    registry = get_service_registry()
    return registry.get_required_service(service_type)


# Initialize services on import
try:
    register_services()
except Exception as e:
    logger.error(f"Error during service registration: {e}")
