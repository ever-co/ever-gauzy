import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task, TaskService } from '.';
import { TaskController } from './task.controller';
import { OrganizationProjects } from '../organization-projects';

@Module({
	imports: [TypeOrmModule.forFeature([Task, OrganizationProjects])],
	controllers: [TaskController],
	providers: [TaskService],
	exports: [TaskService]
})
export class TaskModule {}
