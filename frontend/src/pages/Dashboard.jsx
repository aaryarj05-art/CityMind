import PageContainer from '../components/layout/PageContainer';
import StatCard from '../components/dashboard/StatCard';
import CityMap from '../components/dashboard/CityMap';
import RiskZoneTable from '../components/dashboard/RiskZoneTable';
import IncidentFeed from '../components/dashboard/IncidentFeed';
import ResourceSummary from '../components/dashboard/ResourceSummary';
import SystemStatus from '../components/dashboard/SystemStatus';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { useDashboardData } from '../hooks/useDashboardData';
import { AlertCircle, Map, Siren, Shield, Truck, Clock } from 'lucide-react';

const Dashboard = () => {
  const { data, loading, error, refetch } = useDashboardData();

  if (loading) return <PageContainer title="City Overview"><LoadingState /></PageContainer>;
  if (error) return <PageContainer title="City Overview"><ErrorState message={error} onRetry={refetch} /></PageContainer>;
  if (!data) return <PageContainer title="City Overview"><ErrorState message="No data received" onRetry={refetch} /></PageContainer>;

  const { summary, priority_zones, recent_incidents, resource_summary, map_markers, feed_statuses } = data;

  return (
    <PageContainer title="City Overview">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Active Incidents" value={summary.active_incidents} icon={AlertCircle} color="orange" trend="up" trendValue="+2" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Critical Zones" value={summary.critical_zones} icon={Map} color="red" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Ambulances" value={summary.available_ambulances} icon={Siren} color="red" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Police Units" value={summary.available_police} icon={Shield} color="blue" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Fire Engines" value={summary.available_fire} icon={Truck} color="orange" />
        </div>
        <div className="col-span-1 lg:col-span-2 xl:col-span-1">
          <StatCard title="Avg Response" value={summary.average_response_time} icon={Clock} color="purple" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <CityMap markers={map_markers} />
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Priority Risk Zones</h3>
            <RiskZoneTable zones={priority_zones} />
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="h-[400px]">
            <IncidentFeed incidents={recent_incidents} />
          </div>
          
          <ResourceSummary summary={resource_summary} />
          
          <SystemStatus statuses={summary.feed_statuses} />
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
