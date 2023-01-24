import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { PriorityController } from './priority.controller';
import { Priority } from './priority.entity';
import { PriorityService } from './priority.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/priorities', module: PriorityModule }
		]),
		TypeOrmModule.forFeature([
			Priority
		]),
		TenantModule,
		CqrsModule,
	],
	controllers: [
		PriorityController
	],
	providers: [
		PriorityService
	],
	exports: [
		PriorityService
	],
})
export class PriorityModule {}
