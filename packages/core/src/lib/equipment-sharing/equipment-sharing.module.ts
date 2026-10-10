import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingResolver } from './equipment-sharing.resolver';
import { EquipmentSharingService } from './equipment-sharing.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEquipmentSharingRepository } from './repository/type-orm-equipment-sharing.repository';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';
import { RequestApprovalModule } from '../request-approval/request-approval.module';

/**
 * The periods an asset is handed out for.
 *
 * `EquipmentSharingResolver` is declared here, beside the service and the handlers it calls, because a
 * resolver can only inject what its own module can reach and this module is what reaches them. The
 * service was already exported for the approval module beside it; `CqrsModule` is re-exported now, and
 * that is what makes the resolver's command bus resolvable by whichever module ends up hosting it — a
 * module's imports are not inherited, so a host that declares the resolver receives the bus only if
 * this module hands it on.
 *
 * `FeatureModule` is deliberately not imported although the resolver's chain carries the feature gate:
 * the module is global, so the feature service `FeatureFlagGuard` resolves through is available
 * wherever a guard runs. `RolePermissionModule` is imported for the two guards the resolver shares with
 * the controller — a guard is a provider of whichever module declares the handler it protects — and it
 * was already here for the controller.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EquipmentSharing]),
		MikroOrmModule.forFeature([EquipmentSharing]),
		CqrsModule,
		forwardRef(() => RequestApprovalModule),
		RolePermissionModule
	],
	controllers: [EquipmentSharingController],
	providers: [
		EquipmentSharingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EquipmentSharingResolver,
		TypeOrmEquipmentSharingRepository,
		MikroOrmEquipmentSharingRepository,
		...CommandHandlers
	],
	exports: [EquipmentSharingService, CqrsModule]
})
export class EquipmentSharingModule {}
