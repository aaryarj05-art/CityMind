from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Area, Incident, Resource, Hospital
from app.schemas.dashboard import DashboardSummary, DashboardData, MapMarker

def get_dashboard_summary(db: Session) -> DashboardSummary:
    active_incidents = db.query(Incident).filter(Incident.status.in_(["Reported", "In Progress", "Assigned"])).count()
    critical_zones = db.query(Area).filter(Area.status == "Critical").count()
    
    available_ambulances = db.query(Resource).filter(
        Resource.resource_type == "Ambulance", 
        Resource.status == "Available"
    ).count()
    
    available_police = db.query(Resource).filter(
        Resource.resource_type == "Police Vehicle", 
        Resource.status == "Available"
    ).count()
    
    available_fire = db.query(Resource).filter(
        Resource.resource_type == "Fire Engine", 
        Resource.status == "Available"
    ).count()

    # Mock response time for phase 1
    average_response_time = "8m 42s"
    
    feed_statuses = {
        "Traffic Data Feed": "Online",
        "Weather Feed": "Online",
        "Incident Reporting": "Online",
        "Hospital Capacity Feed": "Simulated",
        "Emergency Resource Feed": "Simulated"
    }

    return DashboardSummary(
        active_incidents=active_incidents,
        critical_zones=critical_zones,
        available_ambulances=available_ambulances,
        available_police=available_police,
        available_fire=available_fire,
        average_response_time=average_response_time,
        feed_statuses=feed_statuses
    )

def get_dashboard_data(db: Session) -> DashboardData:
    summary = get_dashboard_summary(db)
    
    priority_zones = db.query(Area).order_by(Area.operational_score.desc()).limit(5).all()
    recent_incidents = db.query(Incident).order_by(Incident.reported_at.desc()).limit(10).all()
    hospitals = db.query(Hospital).limit(5).all()
    
    resource_summary = {
        "ambulances": {
            "total": db.query(Resource).filter(Resource.resource_type == "Ambulance").count(),
            "available": summary.available_ambulances
        },
        "police": {
            "total": db.query(Resource).filter(Resource.resource_type == "Police Vehicle").count(),
            "available": summary.available_police
        },
        "fire": {
            "total": db.query(Resource).filter(Resource.resource_type == "Fire Engine").count(),
            "available": summary.available_fire
        },
        "municipal": {
            "total": db.query(Resource).filter(Resource.resource_type == "Municipal Unit").count(),
            "available": db.query(Resource).filter(
                Resource.resource_type == "Municipal Unit", 
                Resource.status == "Available"
            ).count()
        }
    }

    map_markers = []
    
    for inc in recent_incidents:
        map_markers.append(MapMarker(
            id=f"inc-{inc.id}",
            type="incident",
            title=inc.title,
            latitude=inc.latitude,
            longitude=inc.longitude,
            status=inc.status,
            details={"category": inc.category, "severity": inc.severity}
        ))
        
    for hosp in hospitals:
        map_markers.append(MapMarker(
            id=f"hosp-{hosp.id}",
            type="hospital",
            title=hosp.name,
            latitude=hosp.latitude,
            longitude=hosp.longitude,
            status=hosp.status,
            details={"available_beds": hosp.available_beds, "total_beds": hosp.total_beds}
        ))

    analytics_preview = {
        "incident_trend": [12, 19, 15, 25, 22, 30, 28], # mock data
        "risk_distribution": {"Low": 5, "Moderate": 3, "High": 2, "Critical": 1}
    }

    return DashboardData(
        summary=summary,
        priority_zones=priority_zones,
        recent_incidents=recent_incidents,
        resource_summary=resource_summary,
        hospitals=hospitals,
        map_markers=map_markers,
        analytics_preview=analytics_preview
    )
