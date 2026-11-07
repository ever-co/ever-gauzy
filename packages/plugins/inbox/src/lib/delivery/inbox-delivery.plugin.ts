import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CreateInboxDeliveryTable1791000005300 } from '../database/migrations/1791000005300-CreateInboxDeliveryTable';
import { CreateInboxPushSubscriptionTable1791000005400 } from '../database/migrations/1791000005400-CreateInboxPushSubscriptionTable';
import { InboxDeliveryMaintenanceModule } from './inbox-delivery-maintenance.module';
import { INBOX_DELIVERY_ENTITIES, InboxDeliveryModule } from './inbox-delivery.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const INBOX_DELIVERY_MIGRATIONS = [CreateInboxDeliveryTable1791000005300, CreateInboxPushSubscriptionTable1791000005400];

/**
 * Email delivery of the Inbox's notifications (the Inbox spec, "Preferences and channels": immediate or digest per
 * kind, the do-not-disturb window, the digest hour). Listed by `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`
 * only on top of the Inbox and when `GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED` is exactly `true`; off (the default) it
 * is not loaded at all: no table, no schedule, no email. The sweep runs where a queue root exists (the worker); the
 * API loads the plugin for its table only.
 */
@Plugin({
	imports: [InboxDeliveryModule, ...(isSchedulerQueueRootEnabled() ? [InboxDeliveryMaintenanceModule] : [])],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...INBOX_DELIVERY_ENTITIES],
	migrations: [...INBOX_DELIVERY_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class InboxDeliveryPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('InboxDeliveryPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('InboxDeliveryPlugin is being destroyed...');
	}
}
