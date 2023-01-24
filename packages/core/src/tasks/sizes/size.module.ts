import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskSize } from './size.entity';
import { TaskSizeService } from './size.service';
import { TaskSizeController } from './size.controller';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-sizes', module: TaskSizeModule }
		]),
		TypeOrmModule.forFeature([
			TaskSize
		]),
		TenantModule,
		CqrsModule,
	],
	controllers: [
		TaskSizeController
	],
	providers: [
		TaskSizeService
	],
	exports: [
		TaskSizeService
	],
})
export class TaskSizeModule {}
