import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EmployeeModule, IntegrationTenantModule } from '@gauzy/core';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';
import { CommandHandlers } from './commands';

@Module({
	imports: [EmployeeModule, IntegrationTenantModule, GauzyAIModule.forRoot(), CqrsModule],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService, ...CommandHandlers]
})
export class EmployeeJobPostModule {}
