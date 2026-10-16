import { Logger, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { EverWorksClientFactory } from './client/ever-works-client.factory';
import { EverWorksConnectionController } from './connection/ever-works-connection.controller';
import { EverWorksConnection } from './connection/ever-works-connection.entity';
import { EverWorksConnectionService } from './connection/ever-works-connection.service';
import { EverWorksHealthScheduler } from './connection/ever-works-health.scheduler';
import { EverWorksNotifier } from './connection/ever-works-notifier.service';
import { MikroOrmEverWorksConnectionRepository } from './connection/repository/mikro-orm-ever-works-connection.repository';
import { TypeOrmEverWorksConnectionRepository } from './connection/repository/type-orm-ever-works-connection.repository';
import { EverWorksCatalogService } from './ever-works-catalog.service';
import { readEverWorksConfig } from './ever-works-config';
import { EverWorksScopeService } from './ever-works-scope.service';
import { EverWorksController } from './ever-works.controller';
import { EverWorksLifecycle } from './ever-works.lifecycle';
import { EVER_WORKS_CONFIG } from './ever-works.tokens';
import { EverWorksMappingController } from './mapping/ever-works-mapping.controller';
import { EverWorksMappingService } from './mapping/ever-works-mapping.service';

/** Every table the plugin owns (its migrations create them). */
export const EVER_WORKS_ENTITIES = [EverWorksConnection];

/**
 * The Ever Works integration module (`@gauzy/plugin-integration-ever-works`). Loaded only when
 * `EVER_WORKS_ENABLED=true` (see `isEverWorksEnabled`).
 *
 * Both ORMs are registered for every entity: the platform selects its ORM at boot, and the paired
 * repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(EVER_WORKS_ENTITIES),
		MikroOrmModule.forFeature(EVER_WORKS_ENTITIES),
		// Gauzy's tenant and permission guards of the management routes need the role permissions.
		RolePermissionModule,
		// The platform's command bus (projects are created through OrganizationProjectCreateCommand).
		CqrsModule
	],
	controllers: [EverWorksController, EverWorksConnectionController, EverWorksMappingController],
	providers: [
		EverWorksCatalogService,
		EverWorksLifecycle,
		EverWorksScopeService,
		EverWorksClientFactory,
		EverWorksNotifier,
		EverWorksConnectionService,
		EverWorksHealthScheduler,
		EverWorksMappingService,
		TypeOrmEverWorksConnectionRepository,
		MikroOrmEverWorksConnectionRepository,
		{
			provide: EVER_WORKS_CONFIG,
			useFactory: () => {
				const logger = new Logger('EverWorks');
				return readEverWorksConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [EverWorksCatalogService, EverWorksConnectionService, EverWorksClientFactory, EverWorksScopeService, EverWorksMappingService, EVER_WORKS_CONFIG]
})
export class EverWorksModule {}
