import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskPriorityController } from './priority.controller';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTaskPriorityRepository } from './repository/type-orm-task-priority.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskPriority]),
		MikroOrmModule.forFeature([TaskPriority]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskPriorityController],
	providers: [TaskPriorityService, TypeOrmTaskPriorityRepository, ...CommandHandlers]
})
export class TaskPriorityModule {}
