import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsResolver } from './availability-slots.resolver';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmAvailabilitySlotRepository } from './repository/type-orm-availability-slot.repository';
import { MikroOrmAvailabilitySlotRepository } from './repository/mikro-orm-availability-slot.repository';

/**
 * The hours an employee is bookable.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is an ordinary provider, so it is declared once here — beside the
 * service it calls — and again by whichever module the Apollo configuration names, because that module is
 * what scans for resolvers. The second instance resolves its dependencies from its own module, so this
 * module has to hand on both the command bus the two write fields dispatch through and the service the
 * reads and the upsert call. The REST controller beside it resolves the bus from this module's own
 * imports, which is why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([AvailabilitySlot]),
		MikroOrmModule.forFeature([AvailabilitySlot]),
		CqrsModule,
		EmployeeModule,
		OrganizationModule,
		RolePermissionModule
	],
	controllers: [AvailabilitySlotsController],
	providers: [
		AvailabilitySlotsService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject services
		// its own module can reach, and this module is what reaches them.
		AvailabilitySlotsResolver,
		TypeOrmAvailabilitySlotRepository,
		MikroOrmAvailabilitySlotRepository,
		...CommandHandlers
	],
	exports: [AvailabilitySlotsService, CqrsModule]
})
export class AvailabilitySlotsModule {}