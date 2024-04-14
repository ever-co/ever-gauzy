import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeModule } from '@gauzy/core';
import { CommandHandlers } from './commands/handlers';
import { EmployeePresetController } from './employee-preset.controller';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from './job-preset.entity';
import { JobPresetService } from './job-preset.service';
import { JobSearchCategoryController } from './job-search-category/job-search-category.controller';
import { JobSearchCategory } from './job-search-category/job-search-category.entity';
import { JobSearchCategoryService } from './job-search-category/job-search-category.service';
import { TypeOrmJobSearchCategoryRepository } from './job-search-category/repository/type-orm-job-search-category.repository';
import { JobSearchOccupationController } from './job-search-occupation/job-search-occupation.controller';
import { JobSearchOccupation } from './job-search-occupation/job-search-occupation.entity';
import { JobSearchOccupationService } from './job-search-occupation/job-search-occupation.service';
import { TypeOrmJobSearchOccupationRepository } from './job-search-occupation/repository/type-orm-job-search-occupation.repository';
import { JobSearchPresetController } from './job-search-preset.controller';
import { TypeOrmJobPresetRepository } from './repository/type-orm-job-preset.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from './repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/type-orm-job-preset-upwork-job-search-criterion.repository';

export const forFeatureEntities = [
	JobPreset,
	JobPresetUpworkJobSearchCriterion,
	EmployeeUpworkJobsSearchCriterion,
	JobSearchOccupation,
	JobSearchCategory
];

@Module({
	imports: [
		RouterModule.register([
			{ path: '/job-preset', module: EmployeeJobPresetModule }
		]),
		TypeOrmModule.forFeature([...forFeatureEntities]),
		MikroOrmModule.forFeature([...forFeatureEntities]),
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
		...CommandHandlers,
		JobPresetService,
		JobSearchCategoryService,
		JobSearchOccupationService,
		TypeOrmJobPresetRepository,
		TypeOrmJobSearchCategoryRepository,
		TypeOrmJobSearchOccupationRepository,
		TypeOrmJobPresetUpworkJobSearchCriterionRepository,
		TypeOrmEmployeeUpworkJobsSearchCriterionRepository
	],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		JobPresetService,
		JobSearchCategoryService,
		JobSearchOccupationService
	]
})
export class EmployeeJobPresetModule { }
