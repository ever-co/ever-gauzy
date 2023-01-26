import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskPriorityController } from './priority.controller';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-priorities', module: TaskPriorityModule },
		]),
		TypeOrmModule.forFeature([TaskPriority]),
		TenantModule,
	],
	controllers: [TaskPriorityController],
	providers: [TaskPriorityService],
	exports: [TaskPriorityService],
})
export class TaskPriorityModule {}
