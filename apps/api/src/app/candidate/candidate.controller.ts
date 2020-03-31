import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';

@ApiTags('Candidate')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateController extends CrudController<Candidate> {
	constructor(private readonly candidateService: CandidateService) {
		super(candidateService);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
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
		@Body() entity: Candidate
	): Promise<any> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return this.candidateService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}

	@ApiOperation({ summary: 'Find all candidates.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates',
		type: Candidate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllCandidades(
		@Query('data') data: string
	): Promise<IPagination<Candidate>> {
		const { relations, findInput } = JSON.parse(data);
		return this.candidateService.findAll({ where: findInput, relations });
	}

	@ApiOperation({ summary: 'Find Candidate by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Candidate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id') id: string): Promise<Candidate> {
		return this.candidateService.findOne(id);
	}
}
