import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Task, OrganizationProjects])],
	controllers: [TaskController],
	providers: [TaskService],
	exports: [TaskService]
})
export class TaskModule {}
