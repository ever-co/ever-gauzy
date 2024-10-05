import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TimeSlot } from './time-slot.entity';
import { TimeSlotController } from './time-slot.controller';
import { TimeSlotMinute } from './time-slot-minute.entity';
import { TimeSlotService } from './time-slot.service';
import { TimeLogModule } from './../time-log/time-log.module';
import { EmployeeModule } from './../../employee/employee.module';
import { ActivityModule } from './../activity/activity.module';
import { TypeOrmTimeSlotRepository } from './repository/type-orm-time-slot.repository';
import { TypeOrmTimeSlotMinuteRepository } from './repository/type-orm-time-slot-minute.repository';

@Module({
	controllers: [TimeSlotController],
	imports: [
		TypeOrmModule.forFeature([TimeSlot, TimeSlotMinute]),
		MikroOrmModule.forFeature([TimeSlot, TimeSlotMinute]),
		RolePermissionModule,
		forwardRef(() => TimeLogModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => ActivityModule),
		CqrsModule
	],
	providers: [TimeSlotService, TypeOrmTimeSlotRepository, TypeOrmTimeSlotMinuteRepository, ...CommandHandlers],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		TimeSlotService,
		TypeOrmTimeSlotRepository,
		TypeOrmTimeSlotMinuteRepository
	]
})
export class TimeSlotModule {}
