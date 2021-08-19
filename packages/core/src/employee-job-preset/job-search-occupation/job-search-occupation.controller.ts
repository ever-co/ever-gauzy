import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JobSearchOccupationService } from './job-search-occupation.service';
import { CrudController } from '../../core/crud';
import { JobSearchOccupation } from './job-search-occupation.entity';

@ApiTags('JobSearchOccupation')
@Controller('job-search-occupation')
export class JobSearchOccupationController extends CrudController<JobSearchOccupation> {
	constructor(occupationService: JobSearchOccupationService) {
		super(occupationService);
	}
}
