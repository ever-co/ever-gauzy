import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@gauzy/config';
import {
	IntegrationEntitySettingModule,
	IntegrationMapModule,
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	RolePermissionModule
} from '@gauzy/core';
import { SimService } from './sim.service';
import { SimController } from './sim.controller';
import { SimClientFactory } from './sim-client.factory';
import { SimWorkflowExecution } from './sim-workflow-execution.entity';
import { MikroOrmSimWorkflowExecutionRepository } from './repository/mikro-orm-sim-workflow-execution.repository';
import { TypeOrmSimWorkflowExecutionRepository } from './repository/type-orm-sim-workflow-execution.repository';

@Module({
	imports: [
		HttpModule,
		CqrsModule,
		ConfigModule,
		IntegrationEntitySettingModule,
		IntegrationMapModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		RolePermissionModule,
		TypeOrmModule.forFeature([SimWorkflowExecution]),
		MikroOrmModule.forFeature([SimWorkflowExecution])
	],
	controllers: [SimController],
	providers: [
		SimService,
		SimClientFactory,
		MikroOrmSimWorkflowExecutionRepository,
		TypeOrmSimWorkflowExecutionRepository
	],
	exports: [SimService, SimClientFactory]
})
export class SimModule {}
