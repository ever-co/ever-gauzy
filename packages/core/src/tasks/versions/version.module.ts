import { CqrsModule } from '@nestjs/cqrs';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskVersion } from './version.entity';
import { TaskVersionController } from './version.controller';
import { TaskVersionService } from './version.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-versions', module: TaskVersionModule }]),
		TypeOrmModule.forFeature([TaskVersion]),
		MikroOrmModule.forFeature([TaskVersion]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskVersionController],
	providers: [TaskVersionService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskVersionService]
})
export class TaskVersionModule {}
