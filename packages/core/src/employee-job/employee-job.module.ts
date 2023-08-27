import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';
import { EmployeeModule } from './../employee/employee.module';
import { CountryModule } from './../country/country.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-job', module: EmployeeJobPostModule }
		]),
		CountryModule,
		EmployeeModule,
		IntegrationTenantModule,
		GauzyAIModule.forRoot()
	],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService],
	exports: [EmployeeJobPostService]
})
export class EmployeeJobPostModule { }
