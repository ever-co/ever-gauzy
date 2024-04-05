import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskSize } from './size.entity';
import { TaskSizeService } from './size.service';
import { TaskSizeController } from './size.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-sizes', module: TaskSizeModule }]),
		TypeOrmModule.forFeature([TaskSize]),
		MikroOrmModule.forFeature([TaskSize]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskSizeController],
	providers: [TaskSizeService, ...CommandHandlers],
	exports: [TaskSizeService]
})
export class TaskSizeModule {}
