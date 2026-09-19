import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedController } from './integration-entity-setting-tied.controller';
import { IntegrationEntitySettingTiedResolver } from './integration-entity-setting-tied.resolver';
import { IntegrationEntitySettingTiedService } from './integration-entity-setting-tied.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureModule } from '../feature/feature.module';
import { TypeOrmIntegrationEntitySettingTiedRepository } from './repository/type-orm-integration-entity-setting-tied.repository';
import { MikroOrmIntegrationEntitySettingTiedRepository } from './repository/mikro-orm-integration-entity-setting-tied.repository';

/**
 * The rows that travel with another synchronised row type.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through.
 *
 * 🛑 The command handlers this resource's controller dispatches are **not** declared here, and that is
 * the delivered state rather than a decision of this file: `commands/handlers` exports
 * `IntegrationEntitySettingTiedUpdateHandler`, no module registers it, and its own dependency on the
 * configured-integration service is what a registration would have to solve first. The GraphQL surface
 * mirrors the route's dispatch as it stands, so the two answer the same refusal until the registration
 * lands; see the resolver beside this file for the reasoning.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySettingTied]),
		MikroOrmModule.forFeature([IntegrationEntitySettingTied]),
		RolePermissionModule,
		CqrsModule,
		FeatureModule
	],
	controllers: [IntegrationEntitySettingTiedController],
	providers: [
		IntegrationEntitySettingTiedService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// command bus its own module can reach, and this module is what reaches it.
		IntegrationEntitySettingTiedResolver,
		TypeOrmIntegrationEntitySettingTiedRepository,
		MikroOrmIntegrationEntitySettingTiedRepository
	],
	exports: [IntegrationEntitySettingTiedService]
})
export class IntegrationEntitySettingTiedModule {}