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
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import {
	PermissionsEnum,
	CandidateCreateInput as ICandidateCreateInput
} from '@gauzy/models';
import { CommandBus } from '@nestjs/cqrs';
import { CandidateCreateCommand, CandidateBulkCreateCommand } from './commands';

@ApiTags('Candidate')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateController extends CrudController<Candidate> {
	constructor(
		private readonly candidateService: CandidateService,
		private readonly commandBus: CommandBus
	) {
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

	@ApiOperation({ summary: 'Find all candidates in the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates in the tenant',
		type: Candidate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllCandidates(
		@Query('data') data: string
	): Promise<IPagination<Candidate>> {
		const { relations, findInput } = JSON.parse(data);
		return this.candidateService.findAll({ where: findInput, relations });
	}

	@ApiOperation({ summary: 'Find Candidate by id in the same tenant.' })
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

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: ICandidateCreateInput,
		...options: any[]
	): Promise<Candidate> {
		return this.commandBus.execute(new CandidateCreateCommand(entity));
	}

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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('/createBulk')
	async createBulk(
		@Body() input: ICandidateCreateInput[],
		...options: any[]
	): Promise<Candidate[]> {
		/**
		 * Use a dummy image avatar if no image is uploaded for any of the Candidate in the list
		 */
		input
			.filter((entity) => !entity.user.imageUrl)
			.map(
				(entity) =>
					(entity.user.imageUrl = getUserDummyImage(entity.user))
			);

		return this.commandBus.execute(new CandidateBulkCreateCommand(input));
	}
}
