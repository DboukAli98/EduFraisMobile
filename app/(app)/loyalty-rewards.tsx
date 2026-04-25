import ParentLoyaltyRewardsScreen from '../../src/screens/parent/ParentLoyaltyRewardsScreen';

// Used by both parent and agent — `useGetMyLoyaltyRewardsQuery` is the
// same shape regardless of role. The agent's combined screen embeds the
// reward cards inline, but a deep-link from elsewhere (e.g. a push
// notification "your points expire soon") will land here.
export default ParentLoyaltyRewardsScreen;
