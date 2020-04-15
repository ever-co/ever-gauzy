import { CandidateEducationService } from './candidate-education.service';
import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { CandidateEducation } from './candidate-education.entity';

@ApiTags('candidate_educations')
@UseGuards(AuthGuard('jwt'))
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
