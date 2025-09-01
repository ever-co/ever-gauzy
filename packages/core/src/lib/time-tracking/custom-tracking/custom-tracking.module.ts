import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CustomTrackingController } from './custom-tracking.controller';
import { CustomTrackingService } from './custom-tracking.service';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotModule } from '../time-slot/time-slot.module';
import { TimeLogModule } from '../time-log/time-log.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([TimeSlot, TimeLog]),
		MikroOrmModule.forFeature([TimeSlot, TimeLog]),
		RolePermissionModule,
		forwardRef(() => TimeSlotModule),
		forwardRef(() => TimeLogModule),
		CqrsModule
	],
	controllers: [CustomTrackingController],
	providers: [CustomTrackingService, ...CommandHandlers],
	exports: [CustomTrackingService]
})
export class CustomTrackingModule {}
