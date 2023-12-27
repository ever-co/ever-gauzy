import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from '../../tenant/tenant.module';
import { TaskVersion } from './version.entity';
import { TaskVersionController } from './version.controller';
import { TaskVersionService } from './version.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-versions', module: TaskVersionModule }]),
		TypeOrmModule.forFeature([TaskVersion]),
		TenantModule,
		CqrsModule
	],
	controllers: [TaskVersionController],
	providers: [TaskVersionService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskVersionService]
})
export class TaskVersionModule {}
