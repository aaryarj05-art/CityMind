from sqlalchemy.orm import Session
from app.models import Area, Incident, Resource, Hospital, Complaint
from datetime import datetime, timedelta, timezone
import random

def seed_db(db: Session):
    if db.query(Area).count() > 0:
        return  # Already seeded

    print("Seeding database with mock Mysuru data...")

    # Areas
    area_names = [
        "Kuvempunagar", "Vijayanagar", "Hebbal", "Jayalakshmipuram",
        "Saraswathipuram", "Nazarbad", "Lashkar Mohalla", "Siddhartha Layout",
        "Bannimantap", "Hinkal", "Bogadi", "Alanahalli"
    ]
    
    # Base coords near Mysuru: 12.3051, 76.6413
    base_lat, base_lng = 12.3051, 76.6413
    
    areas = []
    for i, name in enumerate(area_names):
        lat = base_lat + random.uniform(-0.05, 0.05)
        lng = base_lng + random.uniform(-0.05, 0.05)
        score = random.randint(20, 95)
        status = "Low"
        if score > 50: status = "Moderate"
        if score > 75: status = "High"
        if score > 90: status = "Critical"

        area = Area(
            name=name,
            ward_number=f"W-{i+1:02d}",
            latitude=lat,
            longitude=lng,
            operational_score=score,
            status=status,
            traffic_level=random.choice(["Low", "Moderate", "Heavy", "Gridlock"]),
            rainfall=random.uniform(0, 15),
            complaint_count=random.randint(0, 10),
            active_incident_count=0,
            main_issue=random.choice(["Traffic", "Waterlogging", "Potholes", "None", "Noise"]),
        )
        db.add(area)
        areas.append(area)
    
    db.commit()

    # Get inserted areas to use their IDs
    inserted_areas = db.query(Area).all()
    
    # Hospitals
    hospital_names = ["K.R. Hospital", "JSS Hospital", "Apollo BGS", "Columbia Asia", "Narayana Multispeciality"]
    hospitals = []
    for name in hospital_names:
        area = random.choice(inserted_areas)
        h = Hospital(
            name=name,
            area_id=area.id,
            latitude=area.latitude + random.uniform(-0.005, 0.005),
            longitude=area.longitude + random.uniform(-0.005, 0.005),
            total_beds=random.randint(100, 500),
            available_beds=random.randint(10, 50),
            emergency_capacity=random.choice(["Adequate", "Nearing Capacity", "Full"]),
            status="Online"
        )
        db.add(h)
        hospitals.append(h)
    db.commit()

    # Incidents
    categories = ["Road Accident", "Traffic Congestion", "Waterlogging", "Fire", "Medical Emergency", "Public Disturbance"]
    incidents = []
    for i in range(15):
        area = random.choice(inserted_areas)
        inc = Incident(
            title=f"{random.choice(categories)} at {area.name}",
            description="Mock incident for demonstration purposes.",
            category=random.choice(categories),
            severity=random.choice(["Low", "Medium", "High", "Critical"]),
            status=random.choice(["Reported", "In Progress", "Assigned"]),
            area_id=area.id,
            latitude=area.latitude + random.uniform(-0.01, 0.01),
            longitude=area.longitude + random.uniform(-0.01, 0.01),
            responding_department=random.choice(["Police", "Traffic Police", "Fire Dept", "Medical"]),
            reported_at=datetime.now(timezone.utc) - timedelta(minutes=random.randint(10, 120))
        )
        db.add(inc)
        incidents.append(inc)
        area.active_incident_count += 1
    
    db.commit()

    inserted_incidents = db.query(Incident).all()

    # Resources
    resource_types = ["Ambulance", "Police Vehicle", "Fire Engine", "Municipal Unit"]
    for i in range(30):
        rtype = random.choice(resource_types)
        prefix = "AMB" if rtype == "Ambulance" else "POL" if rtype == "Police Vehicle" else "FIR" if rtype == "Fire Engine" else "MUN"
        area = random.choice(inserted_areas)
        status = random.choice(["Available", "Available", "Available", "Dispatched", "On Scene", "Maintenance"])
        
        assigned = None
        if status in ["Dispatched", "On Scene"] and inserted_incidents:
            assigned = random.choice(inserted_incidents).id
            
        r = Resource(
            resource_code=f"{prefix}-{i+1:03d}",
            resource_type=rtype,
            status=status,
            area_id=area.id,
            latitude=area.latitude + random.uniform(-0.02, 0.02),
            longitude=area.longitude + random.uniform(-0.02, 0.02),
            assigned_incident_id=assigned,
            capacity="Standard"
        )
        db.add(r)
        
    # Complaints
    for i in range(20):
        area = random.choice(inserted_areas)
        c = Complaint(
            title=f"Citizen issue in {area.name}",
            description="Details of the reported problem.",
            category=random.choice(["Pothole", "Streetlight", "Garbage", "Water Supply"]),
            priority=random.choice(["Low", "Normal", "High"]),
            area_id=area.id,
            latitude=area.latitude + random.uniform(-0.01, 0.01),
            longitude=area.longitude + random.uniform(-0.01, 0.01),
            status=random.choice(["Open", "In Progress"])
        )
        db.add(c)

    db.commit()
    print("Database seeded successfully.")
