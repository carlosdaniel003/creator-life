import "./IdentityOnboardingGuard";
import "./StoryResetController";
import "./VideoProductionUxFix";
import "./ExpandedNichePatch";
import "./NotificationCenter";
import "./IndoorAtmosphereFix";
import "./ChannelGrowthEvents";
import "./ChannelComputerActions";
import "./ChannelGrowthStyles";
import "./CollegeAndDynamicGoals";
import "./CollegeGoalsSafeguards";
import "./FoodConsumptionTimePatch";
import { identityReady } from "./PlayerIdentitySystem";

void identityReady.then(async () => {
  await import("../main");
  await import("./HudEnhancements");
});
