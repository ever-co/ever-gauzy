import { Module } from '@nestjs/common';
import { EmployeeModule, IntegrationTenantModule } from '@gauzy/core';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';

@Module({
	imports: [EmployeeModule, IntegrationTenantModule, GauzyAIModule.forRoot()],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService],
	exports: []
})
export class EmployeeJobPostModule { }
