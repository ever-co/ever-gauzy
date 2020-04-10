import { CandidateSource } from './candidate_source.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateSourceService } from './candidate_source.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('candidate_source')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateSourceController extends CrudController<CandidateSource> {
	constructor(
		private readonly candidateSourceService: CandidateSourceService
	) {
		super(candidateSourceService);
	}
}
