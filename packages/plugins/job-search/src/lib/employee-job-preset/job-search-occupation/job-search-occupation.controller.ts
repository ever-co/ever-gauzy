import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '@gauzy/core';
import { JobSearchOccupationService } from './job-search-occupation.service';
import { JobSearchOccupation } from './job-search-occupation.entity';

@ApiTags('JobSearchOccupation')
@Controller('/job-preset/job-search-occupation')
export class JobSearchOccupationController extends CrudController<JobSearchOccupation> {
	constructor(protected readonly jobSearchOccupationService: JobSearchOccupationService) {
		super(jobSearchOccupationService);
	}
}
