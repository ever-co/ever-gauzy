import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import { TaskViewController } from './view.controller';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-views', module: TaskViewModule }]),
		TypeOrmModule.forFeature([TaskView]),
		MikroOrmModule.forFeature([TaskView]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [TaskViewService],
	controllers: [TaskViewController],
	exports: [TaskViewService]
})
export class TaskViewModule {}
