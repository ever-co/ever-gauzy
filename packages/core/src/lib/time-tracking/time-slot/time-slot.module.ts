import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { Organization } from './../../organization/organization.entity';
import { TypeOrmOrganizationRepository } from './../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from './../../organization/repository/mikro-orm-organization.repository';
import { TimeSlot } from './time-slot.entity';
import { TimeSlotController } from './time-slot.controller';
import { TimeSlotService } from './time-slot.service';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { ActivityModule } from './../activity/activity.module';
import { TypeOrmTimeSlotRepository } from './repository/type-orm-time-slot.repository';
import { TimeSlotMinute } from './time-slot-minute/time-slot-minute.entity';
import { TypeOrmTimeSlotMinuteRepository } from './time-slot-minute/repositories/type-orm-time-slot-minute.repository';
import { MikroOrmTimeSlotRepository } from './repository/mikro-orm-time-slot.repository';
import { MikroOrmTimeSlotMinuteRepository } from './time-slot-minute/repositories/mikro-orm-time-slot-minute.repository';

@Module({
	controllers: [TimeSlotController],
	imports: [
		// `Organization` is registered here so that `OrganizationPermissionGuard`, which this
		// controller applies, can read the organization time-tracking policy columns.
		TypeOrmModule.forFeature([TimeSlot, TimeSlotMinute, Organization]),
		MikroOrmModule.forFeature([TimeSlot, TimeSlotMinute, Organization]),
		RolePermissionModule,
		forwardRef(() => TimeLogModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => ActivityModule),
		CqrsModule
	],
	providers: [
		TimeSlotService,
		TypeOrmTimeSlotRepository,
		MikroOrmTimeSlotRepository,
		TypeOrmTimeSlotMinuteRepository,
		MikroOrmTimeSlotMinuteRepository,
		TypeOrmOrganizationRepository,
		MikroOrmOrganizationRepository,
		...CommandHandlers
	],
	exports: [
		TimeSlotService,
		TypeOrmTimeSlotRepository,
		MikroOrmTimeSlotRepository,
		TypeOrmTimeSlotMinuteRepository,
		MikroOrmTimeSlotMinuteRepository
	]
})
export class TimeSlotModule {}
