import React from 'react';
import { ScreenContainer, ThemedText } from '../../components';
import { useRole } from '../../hooks';
import DirectorAgentsScreen from '../director/AgentsScreen';
import AgentOverviewScreen from '../manager/AgentOverviewScreen';

export default function AgentsScreen() {
  const role = useRole();

  if (role === 'director' || role === 'superadmin') {
    return <DirectorAgentsScreen />;
  }

  if (role === 'manager') {
    return <AgentOverviewScreen />;
  }

  return (
    <ScreenContainer>
      <ThemedText variant="h1">Collection Agents</ThemedText>
      <ThemedText variant="body">Agents are only available for director and manager roles.</ThemedText>
    </ScreenContainer>
  );
}
