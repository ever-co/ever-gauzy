import { CandidateEducationService } from './candidate-education.service';
import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateEducation, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { CandidateEducation } from './candidate-education.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('CandidateEducation')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CandidateEducationController extends CrudController<CandidateEducation> {
	constructor(
		private readonly candidateEducationService: CandidateEducationService
	) {
		super(candidateEducationService);
	}
	
	/**
	 * GET all candidate educations 
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all candidate education.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate education',
		type: CandidateEducation
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateEducation>> {
		const { findInput } = data;
		return this.candidateEducationService.findAll({ where: findInput });
	}
}
