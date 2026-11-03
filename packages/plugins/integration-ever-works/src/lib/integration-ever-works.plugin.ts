import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CreateEverWorksConnection1791000001100 } from './database/migrations/1791000001100-CreateEverWorksConnection';
import { CreateEverWorksSyncTables1791000001300 } from './database/migrations/1791000001300-CreateEverWorksSyncTables';
import { CreateEverWorksSyncRun1791000001550 } from './database/migrations/1791000001550-CreateEverWorksSyncRun';
import { AlterEverWorksConnectionOrganizationForeignKey1791000003100 } from './database/migrations/1791000003100-AlterEverWorksConnectionOrganizationForeignKey';
import { CreateEverWorksInboxPreference1791000003510 } from './database/migrations/1791000003510-CreateEverWorksInboxPreference';
import { EVER_WORKS_ENTITIES, EVER_WORKS_SUBSCRIBERS, EverWorksModule } from './ever-works.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const EVER_WORKS_MIGRATIONS = [
	CreateEverWorksConnection1791000001100,
	CreateEverWorksSyncTables1791000001300,
	CreateEverWorksSyncRun1791000001550,
	AlterEverWorksConnectionOrganizationForeignKey1791000003100,
	CreateEverWorksInboxPreference1791000003510
];

/**
 * Ever Gauzy ↔ Ever Works integration (`@gauzy/plugin-integration-ever-works`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`
 * only when `EVER_WORKS_ENABLED` is exactly `true` (`isEverWorksEnabled`). Off (the default) it is not
 * loaded at all: no route, no table (its migrations are not even registered), no timer and no
 * outbound request.
 */
@Plugin({
	imports: [EverWorksModule],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities, and an
	// entity the ORMs never receive fails the boot (MikroORM: "Metadata for entity … not found").
	entities: [...EVER_WORKS_ENTITIES],
	migrations: [...EVER_WORKS_MIGRATIONS],
	subscribers: [...EVER_WORKS_SUBSCRIBERS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationEverWorksPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationEverWorksPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationEverWorksPlugin is being destroyed...');
	}
}
