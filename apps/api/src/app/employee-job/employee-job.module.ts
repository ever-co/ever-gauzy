import { Module } from '@nestjs/common';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';

@Module({
	imports: [],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService],
	exports: [EmployeeJobPostService]
})
export class EmployeeJobPostModule {}
