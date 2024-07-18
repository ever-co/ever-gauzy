import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyAIModule } from '@gauzy/plugin-integration-ai';
import { EmployeeModule, IntegrationTenantModule, RolePermissionModule, TenantModule } from '@gauzy/core';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';
import { CommandHandlers } from './commands';
import { QueryHandlers } from './queries';

@Module({
	imports: [
		EmployeeModule,
		IntegrationTenantModule,
		TenantModule,
		RolePermissionModule,
		GauzyAIModule.forRoot(),
		CqrsModule
	],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService, ...CommandHandlers, ...QueryHandlers]
})
export class EmployeeJobPostModule {}
