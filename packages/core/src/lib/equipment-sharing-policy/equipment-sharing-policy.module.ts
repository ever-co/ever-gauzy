import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyResolver } from './equipment-sharing-policy.resolver';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { TypeOrmEquipmentSharingPolicyRepository } from './repository/type-orm-equipment-sharing-policy.repository';
import { MikroOrmEquipmentSharingPolicyRepository } from './repository/mikro-orm-equipment-sharing-policy.repository';

/**
 * The vocabulary a sharing period is filed under.
 *
 * `EquipmentSharingPolicyResolver` is declared here, beside the service it calls, because a resolver can
 * only inject services its own module can reach and this module is what reaches them. The service is
 * exported beside it because the GraphQL host declares the resolver as a provider of its own module as
 * well — a module's imports are not inherited, so the module that hosts a resolver is the module that
 * has to reach the dependencies it injects.
 *
 * The resolver injects that one service and nothing else, which is why nothing else is exported: this
 * resource serves no write that dispatches a command, so the command bus is not among its dependencies
 * and the module has no `CqrsModule` to hand on. `RolePermissionModule` is imported for the two guards
 * the resolver shares with the controller — a guard is a provider of whichever module declares the
 * handler it protects — and it was already here for the controller. `FeatureModule` is deliberately not
 * imported although the resolver's chain carries the feature gate: that module is global, so the feature
 * service `FeatureFlagGuard` resolves through is available wherever a guard runs.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EquipmentSharingPolicy]),
		MikroOrmModule.forFeature([EquipmentSharingPolicy]),
		RolePermissionModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [
		EquipmentSharingPolicyService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EquipmentSharingPolicyResolver,
		TypeOrmEquipmentSharingPolicyRepository,
		MikroOrmEquipmentSharingPolicyRepository
	],
	exports: [EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyModule {}
