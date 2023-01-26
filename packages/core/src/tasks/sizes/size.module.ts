import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskSize } from './size.entity';
import { TaskSizeService } from './size.service';
import { TaskSizeController } from './size.controller';
import { RouterModule } from 'nest-router';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-sizes', module: TaskSizeModule }
		]),
		TypeOrmModule.forFeature([
			TaskSize
		]),
		TenantModule
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
