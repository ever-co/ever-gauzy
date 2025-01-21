import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskStatus } from './status.entity';
import { TaskStatusController } from './status.controller';
import { TaskStatusService } from './status.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmTaskStatusRepository } from './repository/type-orm-task-status.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskStatus]),
		MikroOrmModule.forFeature([TaskStatus]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskStatusController],
	providers: [TaskStatusService, TypeOrmTaskStatusRepository, ...QueryHandlers, ...CommandHandlers]
})
export class TaskStatusModule {}
