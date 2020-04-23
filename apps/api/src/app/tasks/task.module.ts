import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [
		TypeOrmModule.forFeature([Task, OrganizationProjects]),
		CqrsModule
	],
	controllers: [TaskController],
	providers: [TaskService, ...CommandHandlers],
	exports: [TaskService]
})
export class TaskModule {}
