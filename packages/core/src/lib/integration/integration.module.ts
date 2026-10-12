import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureModule } from '../feature/feature.module';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { Integration } from './integration.entity';
import { IntegrationType } from './integration-type.entity';
import { IntegrationController } from './integration.controller';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { IntegrationTypeService } from './integration-type.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmIntegrationRepository } from './repository/type-orm-integration.repository';
import { MikroOrmIntegrationRepository } from './repository/mikro-orm-integration.repository';
import { TypeOrmIntegrationTypeRepository } from './repository/type-orm-integration-type.repository';
import { MikroOrmIntegrationTypeRepository } from './repository/mikro-orm-integration-type.repository';

/**
 * The integration catalogue: what this installation can be connected to, and the facets it is filed
 * under.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated
 * by `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it
 * protects — so this module is what has to reach the feature service the guard resolves through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Integration, IntegrationType]),
		MikroOrmModule.forFeature([Integration, IntegrationType]),
		CqrsModule,
		IntegrationTenantModule,
		RolePermissionModule,
		FeatureModule
	],
	controllers: [IntegrationController],
	providers: [
		IntegrationService,
		IntegrationTypeService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// command bus its own module can reach, and this module is what reaches it.
		IntegrationResolver,
		TypeOrmIntegrationRepository, MikroOrmIntegrationRepository,
		TypeOrmIntegrationTypeRepository, MikroOrmIntegrationTypeRepository,
		...CommandHandlers
	],
	exports: [IntegrationService]
})
export class IntegrationModule {}