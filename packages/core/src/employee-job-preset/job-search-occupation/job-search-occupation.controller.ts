import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JobSearchOccupationService } from './job-search-occupation.service';
import { CrudController } from '../../core/crud/crud.controller';
import { JobSearchOccupation } from './job-search-occupation.entity';

@ApiTags('JobSearchOccupation')
@UseGuards(AuthGuard('jwt'))
@Controller('job-search-occupation')
export class JobSearchOccupationController extends CrudController<JobSearchOccupation> {
	constructor(occupationService: JobSearchOccupationService) {
		super(occupationService);
	}
}
