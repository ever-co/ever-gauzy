import { CandidateEducationService } from './candidate-education.service';
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateEducation } from './candidate-education.entity';

@ApiTags('candidate_educations')
@Controller()
export class CandidateEducationController extends CrudController<
	CandidateEducation
> {
	constructor(
		private readonly candidateEducationService: CandidateEducationService
	) {
		super(candidateEducationService);
	}
}
