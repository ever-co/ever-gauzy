import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureToggleController } from './feature-toggle.controller';
import { FeatureToggleResolver } from './feature-toggle.resolver';
import { FeatureService } from './feature.service';
import { FeatureOrganizationService } from './feature-organization.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmFeatureRepository } from './repository/type-orm-feature.repository';
import { MikroOrmFeatureRepository } from './repository/mikro-orm-feature.repository';
import { TypeOrmFeatureOrganizationRepository } from './repository/type-orm-feature-organization.repository';
import { MikroOrmFeatureOrganizationRepository } from './repository/mikro-orm-feature-organization.repository';

/**
 * The feature gate: the catalogue, the tenant's toggle rows and the guard they are read through.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 *
 * `FeatureService` and `FeatureOrganizationService` are already exported, and they are what both the
 * resolver and `FeatureFlagGuard` inject — the guard's own dependency is the reason this module is
 * public API at all (see `packages/core/src/index.ts`).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Feature, FeatureOrganization]),
		MikroOrmModule.forFeature([Feature, FeatureOrganization]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [FeatureToggleController],
	providers: [
		FeatureService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		FeatureToggleResolver,
		FeatureOrganizationService,
		TypeOrmFeatureRepository,
		MikroOrmFeatureRepository,
		TypeOrmFeatureOrganizationRepository,
		MikroOrmFeatureOrganizationRepository,
		...CommandHandlers
	],
	exports: [FeatureService, FeatureOrganizationService, CqrsModule]
})
export class FeatureModule {}
