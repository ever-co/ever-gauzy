import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CustomTrackingController } from './custom-tracking.controller';
import { CustomTrackingService } from './custom-tracking.service';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotSession } from '../time-slot-session/time-slot-session.entity';
import { TimeSlotSessionService } from '../time-slot-session/time-slot-session.service';
import { TimeSlotModule } from '../time-slot/time-slot.module';
import { TimeLogModule } from '../time-log/time-log.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTimeSlotRepository } from '../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotSessionRepository } from '../time-slot-session/repository/type-orm-time-slot-session.repository';
import { MikroOrmTimeSlotSessionRepository } from '../time-slot-session/repository/mikro-orm-time-slot-session.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TimeSlot, TimeLog, TimeSlotSession]),
		MikroOrmModule.forFeature([TimeSlot, TimeLog, TimeSlotSession]),
		RolePermissionModule,
		forwardRef(() => TimeSlotModule),
		forwardRef(() => TimeLogModule),
		CqrsModule
	],
	controllers: [CustomTrackingController],
	providers: [
		CustomTrackingService,
		TimeSlotSessionService,
		TypeOrmTimeSlotRepository,
		MikroOrmTimeSlotRepository,
		TypeOrmTimeSlotSessionRepository,
		MikroOrmTimeSlotSessionRepository,
		...CommandHandlers
	],
	exports: [CustomTrackingService, TimeSlotSessionService]
})
export class CustomTrackingModule {}
