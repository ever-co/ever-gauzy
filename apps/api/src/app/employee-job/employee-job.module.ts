import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeJobPost } from './employee-job.entity';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPostController } from './employee-job.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeJobPost])],
	controllers: [EmployeeJobPostController],
	providers: [EmployeeJobPostService],
	exports: [EmployeeJobPostService]
})
export class EmployeeJobPostModule {}
