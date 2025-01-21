import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskSize } from './size.entity';
import { TaskSizeService } from './size.service';
import { TaskSizeController } from './size.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTaskSizeRepository } from './repository/type-orm-task-size.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskSize]),
		MikroOrmModule.forFeature([TaskSize]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [TaskSizeController],
	providers: [TaskSizeService, TypeOrmTaskSizeRepository, ...CommandHandlers]
})
export class TaskSizeModule {}
