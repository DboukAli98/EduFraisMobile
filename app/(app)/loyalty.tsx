import { useAppSelector } from '../../src/hooks';
import ParentLoyaltyDashboard from '../../src/screens/parent/ParentLoyaltyDashboard';
import AgentLoyaltyScreen from '../../src/screens/agent/AgentLoyaltyScreen';

/**
 * The "/loyalty" route is role-aware so the same deep-link target works
 * for parents and agents — each role gets their own optimized screen
 * (parent → dashboard with switcher, agent → single combined view).
 */
export default function LoyaltyRoute() {
  const role = useAppSelector((state) => state.auth.user?.role);
  if (role === 'agent') {
    return <AgentLoyaltyScreen />;
  }
  return <ParentLoyaltyDashboard />;
}
