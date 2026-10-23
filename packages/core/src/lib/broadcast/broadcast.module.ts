import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { Broadcast } from './broadcast.entity';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { BroadcastResolver } from './broadcast.resolver';
import { TypeOrmBroadcastRepository } from './repository/type-orm-broadcast.repository';
import { MikroOrmBroadcastRepository } from './repository/mikro-orm-broadcast.repository';
import { CommandHandlers } from './commands/handlers';

/**
 * The messages an organization publishes.
 *
 * `BroadcastResolver` is declared here, beside the service and the handlers it calls, because a resolver
 * can only inject what its own module can reach and this module is what reaches them. `CqrsModule` is
 * re-exported, and that is what makes the resolver's command bus resolvable by whichever module ends up
 * hosting it: both writes dispatch the command their route dispatches, so the bus has to travel with the
 * resolver — a module's imports are not inherited, so a host that declares the resolver receives the bus
 * only if this module hands it on. The repositories were exported before and stay exported for the same
 * reason.
 *
 * `FeatureModule` is deliberately not imported although the resolver's chain carries the feature gate:
 * that module is global, so the feature service `FeatureFlagGuard` resolves through is available wherever
 * a guard runs. `RolePermissionModule` is imported for the two guards the resolver shares with the
 * controller — a guard is a provider of whichever module declares the handler it protects — and it was
 * already here for the controller.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Broadcast]),
		MikroOrmModule.forFeature([Broadcast]),
		CqrsModule,
		RolePermissionModule,
		EmployeeModule,
		RoleModule,
		OrganizationTeamEmployeeModule,
		EmployeeNotificationModule,
	],
	controllers: [BroadcastController],
	providers: [
		BroadcastService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		BroadcastResolver,
		TypeOrmBroadcastRepository,
		MikroOrmBroadcastRepository,
		...CommandHandlers
	],
	exports: [BroadcastService, CqrsModule, TypeOrmBroadcastRepository, MikroOrmBroadcastRepository]
})
export class BroadcastModule {}
