import { Routes } from '@angular/router';
import { provideEffects, provideEffectsManager } from '@ngneat/effects-ng';
import { PendingInstallationEffects } from './component/+state/pending-installation.effect';
import { PluginEffects } from './component/+state/plugin.effect';
import { AvailableUsersEffects } from './component/plugin-marketplace/+state/effects/available-users.effects';
import { PluginCategoryEffects } from './component/plugin-marketplace/+state/effects/plugin-category.effect';
import { PluginInstallationEffects } from './component/plugin-marketplace/+state/effects/plugin-installation.effect';
import { PluginMarketplaceEffects } from './component/plugin-marketplace/+state/effects/plugin-marketplace.effect';
import { PluginPlanComparisonEffects } from './component/plugin-marketplace/+state/effects/plugin-plan-comparison.effect';
import { PluginPlanEffects } from './component/plugin-marketplace/+state/effects/plugin-plan.effect';
import { PluginSettingsEffects } from './component/plugin-marketplace/+state/effects/plugin-settings.effects';
import { PluginSourceEffects } from './component/plugin-marketplace/+state/effects/plugin-source.effect';
import { PluginSubscriptionAccessEffects } from './component/plugin-marketplace/+state/effects/plugin-subscription-access.effects';
import { PluginSubscriptionEffects } from './component/plugin-marketplace/+state/effects/plugin-subscription.effect';
import { PluginToggleEffects } from './component/plugin-marketplace/+state/effects/plugin-toggle.effects';
import { PluginUploadIntentEffects } from './component/plugin-marketplace/+state/effects/plugin-upload-intent.effect';
import { PluginUserAssignmentEffects } from './component/plugin-marketplace/+state/effects/plugin-user-assignment.effects';
import { PluginVersionEffects } from './component/plugin-marketplace/+state/effects/plugin-version.effect';

export const PluginRoutingModule: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./component/plugin-layout/plugin-layout.component').then((m) => m.PluginLayoutComponent),
		loadChildren: () => import('./plugin.route').then((m) => m.routes),
		providers: [
			provideEffectsManager(),
			provideEffects(
				PluginEffects,
				PluginInstallationEffects,
				PluginMarketplaceEffects,
				PluginVersionEffects,
				PluginSourceEffects,
				PluginUserAssignmentEffects,
				PluginSettingsEffects,
				PluginSubscriptionEffects,
				PluginPlanEffects,
				PluginPlanComparisonEffects,
				PluginSubscriptionAccessEffects,
				AvailableUsersEffects,
				PluginToggleEffects,
				PluginCategoryEffects,
				PluginUploadIntentEffects,
				PendingInstallationEffects
			)
		]
	}
];
