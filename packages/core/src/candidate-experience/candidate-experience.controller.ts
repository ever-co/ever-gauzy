import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateExperience, IPagination } from '@gauzy/contracts';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from './../core/crud';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('CandidateExperience')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateExperienceController extends CrudController<CandidateExperience> {
	constructor(
		private readonly candidateExperienceService: CandidateExperienceService
	) {
		super(candidateExperienceService);
	}

	@ApiOperation({
		summary: 'Find all candidate experience.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate experience',
		type: CandidateExperience
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateExperience>> {
		const { findInput, relations } = data;
		return this.candidateExperienceService.findAll({
			where: findInput,
			relations
		});
	}
}
