import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { INBOX_MIGRATIONS } from './database/inbox-migrations';
import { INBOX_ENTITIES, InboxModule } from './inbox.module';

export { INBOX_MIGRATIONS };

/**
 * The Gauzy Inbox (`@gauzy/plugin-inbox`, plan 04, G-P3-1).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` only when `GAUZY_INBOX_ENABLED` is
 * exactly `true` (`isInboxEnabled`). Off (the default) it is not loaded at all: no route, no table (its
 * migrations are not even registered) and no role grant.
 */
@Plugin({
	imports: [InboxModule],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...INBOX_ENTITIES],
	migrations: [...INBOX_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class InboxPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('InboxPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('InboxPlugin is being destroyed...');
	}
}
