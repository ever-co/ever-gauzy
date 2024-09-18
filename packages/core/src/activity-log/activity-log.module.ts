import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog } from './activity-log.entity';
import { TypeOrmActivityLogRepository } from './repository/type-orm-activity-log.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ActivityLog]),
		MikroOrmModule.forFeature([ActivityLog]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [ActivityLogService, TypeOrmActivityLogRepository, ...CommandHandlers, ...EventHandlers],
	exports: [ActivityLogService, TypeOrmModule, TypeOrmActivityLogRepository]
})
export class ActivityLogModule {}
