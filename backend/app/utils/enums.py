from enum import Enum

class ResourceStatus(str, Enum):
    AVAILABLE = "Available"
    DISPATCHED = "Dispatched"
    ON_SCENE = "On Scene"
    RETURNING = "Returning"
    MAINTENANCE = "Maintenance"
    OFFLINE = "Offline"

class IncidentStatus(str, Enum):
    REPORTED = "Reported"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"

class OperationalStatus(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    CRITICAL = "Critical"
