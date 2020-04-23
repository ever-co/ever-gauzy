import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';

@ApiTags('candidate_experience')
@Controller()
export class CandidateExperienceController extends CrudController<
	CandidateExperience
> {
	constructor(
		private readonly candidateExperienceService: CandidateExperienceService
	) {
		super(candidateExperienceService);
	}
}
