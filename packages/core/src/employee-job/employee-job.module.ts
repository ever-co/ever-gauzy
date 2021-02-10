import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GauzyAIService } from '@gauzy/integration-ai';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-job', module: EmployeeJobPostModule }
		]),
		TypeOrmModule.forFeature([Employee])
	],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService, EmployeeService, GauzyAIService],
	exports: [EmployeeJobPostService]
})
export class EmployeeJobPostModule {}
