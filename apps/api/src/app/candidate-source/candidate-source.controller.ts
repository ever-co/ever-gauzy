import { CandidateSource } from './candidate-source.entity';
import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateSourceService } from './candidate-source.service';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';

@ApiTags('candidate_source')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateSourceController extends CrudController<CandidateSource> {
	constructor(
		private readonly candidateSourceService: CandidateSourceService
	) {
		super(candidateSourceService);
	}
	@ApiOperation({
		summary: 'Find all candidate source.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate source',
		type: CandidateSource
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findSource(
		@Query('data') data: string
	): Promise<IPagination<CandidateSource>> {
		const { findInput } = JSON.parse(data);
		return this.candidateSourceService.findAll({ where: findInput });
	}
}
