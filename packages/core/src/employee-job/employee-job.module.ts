import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';
import { EmployeeModule } from './../employee/employee.module';
import { CountryModule } from './../country/country.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-job', module: EmployeeJobPostModule }
		]),
		CountryModule,
		EmployeeModule,
		GauzyAIModule
	],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService],
	exports: [EmployeeJobPostService]
})
export class EmployeeJobPostModule { }
