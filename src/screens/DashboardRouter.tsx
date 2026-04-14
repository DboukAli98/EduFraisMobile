import React from 'react';
import { useAppSelector } from '../store/store';
import ParentDashboard from './parent/ParentDashboard';
import DirectorDashboard from './director/DirectorDashboard';
import ManagerDashboard from './manager/ManagerDashboard';
import AgentDashboard from './agent/AgentDashboard';

export default function DashboardRouter() {
  const role = useAppSelector((state) => state.auth.user?.role);

  switch (role) {
    case 'director':
      return <DirectorDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'agent':
      return <AgentDashboard />;
    default:
      return <ParentDashboard />;
  }
}
