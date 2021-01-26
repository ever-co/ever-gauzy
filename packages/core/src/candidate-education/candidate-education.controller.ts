import { CandidateEducationService } from './candidate-education.service';
import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateEducation } from './candidate-education.entity';
import { IPagination } from '../core';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('CandidateEducation')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateEducationController extends CrudController<CandidateEducation> {
	constructor(
		private readonly candidateEducationService: CandidateEducationService
	) {
		super(candidateEducationService);
	}
	// GET
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
	async findEducations(
		@Query('data') data: string
	): Promise<IPagination<CandidateEducation>> {
		const { findInput } = JSON.parse(data);
		return this.candidateEducationService.findAll({ where: findInput });
	}
}
