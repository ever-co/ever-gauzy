import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Post
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, getUserDummyImage } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { PermissionsEnum, CandidateCreateInput } from '@gauzy/models';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { CandidateBulkCreateCommand } from './commands/candidate.bulk.create.command';

@ApiTags('Candidate')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateController extends CrudController<Candidate> {
	[x: string]: any;
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
		console.log('relations', relations);
		console.log('findInput', findInput);
		console.log('data', data);
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

	//
	@ApiOperation({ summary: 'Create records in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	// @new Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Post('/createBulk')
	async createBulk(
		@Body()
		input: // CandidateCreateInput
		any[],
		...options: any[]
	): Promise<Candidate[]> {
		/**
		 * Use a dummy image avatar if no image is uploaded for any of the employees in the list
		 */
		console.log('input IN CANDIDAT CONTROLLER', input);
		// input
		// 	.filter((entity) => !entity.user.imageUrl)
		// 	.map(
		// 		(entity) =>
		// 			(entity.user.imageUrl = getUserDummyImage(entity.user))
		// 	);
		// this.commandBus.execute(new CandidateBulkCreateCommand(input));
		return;
	}
}
