import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskVersion } from './version.entity';
import { TaskVersionController } from './version.controller';
import { TaskVersionService } from './version.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmTaskVersionRepository } from './repository/type-orm-task-version.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskVersion]),
		MikroOrmModule.forFeature([TaskVersion]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskVersionController],
	providers: [TaskVersionService, TypeOrmTaskVersionRepository, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskVersionService]
})
export class TaskVersionModule {}
