import { Logger, Module } from '@nestjs/common';
import { RolePermissionModule } from '@gauzy/core';
import { EverWorksCatalogService } from './ever-works-catalog.service';
import { readEverWorksConfig } from './ever-works-config';
import { EverWorksController } from './ever-works.controller';
import { EverWorksLifecycle } from './ever-works.lifecycle';
import { EVER_WORKS_CONFIG } from './ever-works.tokens';

/**
 * The Ever Works integration module (`@gauzy/plugin-integration-ever-works`). Loaded only when
 * `EVER_WORKS_ENABLED=true` (see `isEverWorksEnabled`).
 */
@Module({
	// Gauzy's tenant and permission guards of the management routes need the role permissions.
	imports: [RolePermissionModule],
	controllers: [EverWorksController],
	providers: [
		EverWorksCatalogService,
		EverWorksLifecycle,
		{
			provide: EVER_WORKS_CONFIG,
			useFactory: () => {
				const logger = new Logger('EverWorks');
				return readEverWorksConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [EverWorksCatalogService, EVER_WORKS_CONFIG]
})
export class EverWorksModule {}
