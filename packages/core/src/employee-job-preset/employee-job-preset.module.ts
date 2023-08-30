import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { EmployeeModule } from './../employee/employee.module';
import { Handlers } from './commands/handlers';
import { EmployeePresetController } from './employee-preset.controller';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from './job-preset.entity';
import { JobPresetService } from './job-preset.service';
import { JobSearchCategoryController } from './job-search-category/job-search-category.controller';
import { JobSearchCategory } from './job-search-category/job-search-category.entity';
import { JobSearchCategoryService } from './job-search-category/job-search-category.service';
import { JobSearchOccupationController } from './job-search-occupation/job-search-occupation.controller';
import { JobSearchOccupation } from './job-search-occupation/job-search-occupation.entity';
import { JobSearchOccupationService } from './job-search-occupation/job-search-occupation.service';
import { JobSearchPresetController } from './job-search-preset.controller';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/job-preset', module: EmployeeJobPresetModule }
		]),
		TypeOrmModule.forFeature([
			JobPreset,
			JobPresetUpworkJobSearchCriterion,
			EmployeeUpworkJobsSearchCriterion,
			JobSearchOccupation,
			JobSearchCategory
		]),
		EmployeeModule,
		CqrsModule,
		GauzyAIModule.forRoot()
	],
	controllers: [
		JobSearchOccupationController,
		JobSearchCategoryController,
		EmployeePresetController,
		JobSearchPresetController
	],
	providers: [
		...Handlers,
		JobPresetService,
		JobSearchCategoryService,
		JobSearchOccupationService
	],
	exports: [
		JobPresetService,
		JobSearchCategoryService,
		JobSearchOccupationService
	]
})
export class EmployeeJobPresetModule { }
