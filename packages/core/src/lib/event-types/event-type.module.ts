import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
import { EventTypeResolver } from './event-type.resolver';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEventTypeRepository } from './repository/type-orm-event-types.repository';
import { MikroOrmEventTypeRepository } from './repository/mikro-orm-event-type.repository';

/**
 * The organization's vocabulary of meeting lengths.
 *
 * `EventTypeResolver` is declared here, beside the service and the handler it calls, because a resolver
 * can only inject what its own module can reach and this module is what reaches them. `CqrsModule` is
 * re-exported and the service beside it, and that is what makes the resolver's two dependencies
 * resolvable by whichever module ends up hosting it: the create dispatches the command the delivered route
 * dispatches, so the bus has to travel with the resolver — a module's imports are not inherited, so a host
 * that declares the resolver receives the bus only if this module hands it on.
 *
 * `FeatureModule` is deliberately not imported although the resolver's chain carries the feature gate:
 * that module is global, so the feature service `FeatureFlagGuard` resolves through is available wherever
 * a guard runs. `RolePermissionModule` is imported for the guard the resolver shares with the controller —
 * a guard is a provider of whichever module declares the handler it protects — and it was already here for
 * the controller. `EmployeeModule` and `OrganizationModule` were here for the controller's command handler
 * and stay: the same handler is what the create field dispatches through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EventType]),
		MikroOrmModule.forFeature([EventType]),
		RolePermissionModule,
		EmployeeModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [EventTypeController],
	providers: [
		EventTypeService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EventTypeResolver,
		TypeOrmEventTypeRepository,
		MikroOrmEventTypeRepository,
		...CommandHandlers
	],
	exports: [EventTypeService, CqrsModule]
})
export class EventTypeModule {}
