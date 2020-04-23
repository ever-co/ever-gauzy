import { CandidateEducationService } from './candidate-education.service';
import {
	Controller,
	UseGuards,
	Get,
	Query,
	HttpStatus,
	HttpCode,
	Delete,
	Param,
	Put,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { CandidateEducation } from './candidate-education.entity';
import { IPagination } from '../core';
import { Education } from 'libs/models/src/lib/candidate-education.model';

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
	//////   GET
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

	/////////   UPDATE
	@ApiOperation({ summary: 'Update an education' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The education has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Education not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: Education
	): Promise<any> {
		return this.candidateEducationService.update(id, { ...entity });
	}

	///////  DELETE
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: "This Education can't be deleted"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id') id: string, ...options: any[]): Promise<any> {
		return this.candidateEducationService.deleteEducation(id);
	}
}
