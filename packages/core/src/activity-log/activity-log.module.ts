import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ActivityLogService } from './activity-log.service';
import { TypeOrmActivityLogRepository } from './repository/type-orm-activity-log.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Comment]),
		MikroOrmModule.forFeature([Comment]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [ActivityLogService],
	exports: [ActivityLogService, TypeOrmModule, TypeOrmActivityLogRepository]
})
export class ActivityLogModule {}
