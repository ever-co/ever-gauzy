import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { EmployeeModule } from './../../employee/employee.module';
import { OrganizationProjectModule } from './../../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { Activity } from './activity.entity';
import { ActivityMapService } from './activity.map.service';
import { TimeSlotModule } from './../time-slot/time-slot.module';
import { TypeOrmActivityRepository } from './repository/type-orm-activity.repository';

@Module({
	controllers: [ActivityController],
	imports: [
		TypeOrmModule.forFeature([Activity]),
		MikroOrmModule.forFeature([Activity]),
		RolePermissionModule,
		EmployeeModule,
		OrganizationProjectModule,
		forwardRef(() => TimeSlotModule),
		CqrsModule
	],
	providers: [ActivityService, ActivityMapService, TypeOrmActivityRepository, ...CommandHandlers],
	exports: [ActivityService, ActivityMapService, TypeOrmActivityRepository]
})
export class ActivityModule {}
