import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskSize } from './size.entity';
import { TaskSizeService } from './size.service';
import { TaskSizeController } from './size.controller';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-sizes', module: TaskSizeModule }
		]),
		TypeOrmModule.forFeature([
			TaskSize
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [
		TaskSizeController
	],
	providers: [
		TaskSizeService,
		...CommandHandlers
	],
	exports: [
		TaskSizeService
	],
})
export class TaskSizeModule { }
