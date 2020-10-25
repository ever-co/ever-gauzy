import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Handlers } from './commands/handlers';
import { EmployeeJobPresetController } from './employee-job-preset.controller';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from './job-preset.entity';
import { JobPresetService } from './job-preset.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			JobPreset,
			JobPresetUpworkJobSearchCriterion,
			EmployeeUpworkJobsSearchCriterion
		]),
		CqrsModule
	],
	controllers: [EmployeeJobPresetController],
	providers: [...Handlers, JobPresetService],
	exports: [JobPresetService]
})
export class EmployeeJobPresetModule {}
