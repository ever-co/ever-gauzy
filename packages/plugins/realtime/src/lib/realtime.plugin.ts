import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { REALTIME_MIGRATIONS } from './database/realtime-migrations';
import { RealtimeResolver } from './graphql/realtime.resolver';
import { realtimeSchemaExtensions } from './graphql/realtime.schema';
import { REALTIME_ENTITIES } from './realtime.entities';
import { RealtimeModule } from './realtime.module';

export { REALTIME_MIGRATIONS };

/**
 * The real-time channel (`@gauzy/plugin-realtime`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` only when `GAUZY_REALTIME_ENABLED` is
 * exactly `true` (`isRealtimeEnabled`). Off (the default) it is not loaded at all: no route, no GraphQL field,
 * no outbox row, no role grant, no table (its migrations are not even registered).
 */
@Plugin({
	imports: [RealtimeModule],
	// Hints live on the platform's event outbox; the plugin's own tables hold per-connection presence and the replay
	// watermark. Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...REALTIME_ENTITIES],
	migrations: [...REALTIME_MIGRATIONS],
	// `Subscription.collaborationEvents`, served only with the plugin.
	extensions: {
		schema: realtimeSchemaExtensions,
		resolvers: [RealtimeResolver]
	},
	configuration: (config: ApplicationPluginConfig) => config
})
export class RealtimePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('RealtimePlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('RealtimePlugin is being destroyed...');
	}
}
