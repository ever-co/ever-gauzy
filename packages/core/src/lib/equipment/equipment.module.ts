import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Equipment } from './equipment.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentResolver } from './equipment.resolver';
import { EquipmentService } from './equipment.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEquipmentRepository } from './repository/type-orm-equipment.repository';
import { MikroOrmEquipmentRepository } from './repository/mikro-orm-equipment.repository';

/**
 * The tracked assets of an organization.
 *
 * `EquipmentResolver` is declared here, beside the service it calls, because a resolver can only inject
 * services its own module can reach and this module is what reaches them. The service is exported
 * beside it because the GraphQL host declares the resolver as a provider of its own module as well —
 * a module's imports are not inherited, so the module that hosts a resolver is the module that has to
 * reach the dependencies it injects.
 *
 * The resolver injects that one service and nothing else, which is why nothing else is exported: this
 * resource serves no write that dispatches a command, so the command bus is not among its dependencies
 * and the module has no `CqrsModule` to hand on. `RolePermissionModule` is imported for the guard the
 * resolver shares with the controller — a guard is a provider of whichever module declares the handler
 * it protects — and it was already here for the controller. `FeatureModule` is deliberately not
 * imported although the resolver's chain carries the feature gate: that module is global, so the
 * feature service `FeatureFlagGuard` resolves through is available wherever a guard runs.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Equipment]), MikroOrmModule.forFeature([Equipment]), RolePermissionModule],
	controllers: [EquipmentController],
	providers: [
		EquipmentService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EquipmentResolver,
		TypeOrmEquipmentRepository,
		MikroOrmEquipmentRepository
	],
	exports: [EquipmentService]
})
export class EquipmentModule {}
