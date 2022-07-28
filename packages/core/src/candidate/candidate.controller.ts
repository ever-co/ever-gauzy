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
	Post,
	UseInterceptors,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import {
	PermissionsEnum,
	LanguagesEnum,
	ICandidate,
	IPagination
} from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm';
import { CrudController, PaginationParams} from './../core/crud';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { BulkBodyLoadTransformPipe, ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import {
	CandidateCreateCommand,
	CandidateBulkCreateCommand,
	CandidateUpdateCommand,
	CandidateHiredCommand,
	CandidateRejectedCommand
} from './commands';
import { TransformInterceptor } from './../core/interceptors';
import { CreateCandidateDTO, UpdateCandidateDTO, CandidateBulkInputDTO } from './dto';

@ApiTags('Candidate')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(TransformInterceptor)
@Controller()
export class CandidateController extends CrudController<Candidate> {
	constructor(
		private readonly candidateService: CandidateService,
		private readonly commandBus: CommandBus
	) {
		super(candidateService);
	}

	/**
	 * CREATE bulk candidate
	 *
	 * @param body
	 * @param languageCode
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Create records in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('/bulk')
	async createBulk(
		@Body(BulkBodyLoadTransformPipe, new ValidationPipe({ transform : true })) body: CandidateBulkInputDTO,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<ICandidate[]> {
		return await this.commandBus.execute(
			new CandidateBulkCreateCommand(body.list, languageCode)
		);
	}

	/**
	 * GET candidate counts
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidates counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates count'
	})
	@Get('count')
    async getCount(
		@Query() options: FindOptionsWhere<Candidate>
	): Promise<number> {
        return await this.candidateService.countBy(options);
    }

	/**
	 * GET candidates by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidates in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates in the tenant',
		type: Candidate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ICandidate>
	): Promise<IPagination<ICandidate>> {
		return this.candidateService.pagination(filter);
	}

	/**
	 * GET all candidates
	 *
	 * @param data
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidate>> {
		const { relations, findInput } = data;
		return this.candidateService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET candidate by id
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Candidate by id ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Candidate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<ICandidate> {
		const { relations = [] } = data;
		return this.candidateService.findOneByIdString(id, {
			relations
		});
	}

	/**
	 * CREATE new candidate
	 *
	 * @param body
	 * @param options
	 * @returns
	 */
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
	@Post()
	@UsePipes( new ValidationPipe({ transform : true }) )
	async create(
		@Body() body: CreateCandidateDTO
	): Promise<ICandidate> {
		return await this.commandBus.execute(
			new CandidateCreateCommand(body)
		);
	}

	/**
	 * UPDATE Candidate By Id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.OK,
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Put(':id')
	@UsePipes( new ValidationPipe({ transform : true }) )
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateCandidateDTO
	): Promise<ICandidate> {
		return await this.commandBus.execute(
			new CandidateUpdateCommand({ id, ...entity })
		);
	}

	/**
	 * Hired candidate user and migrate to employee user
	 * UPDATE Candidate By Id
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record and migrate candidate to employee user' })
	@ApiResponse({
		status: HttpStatus.OK,
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
	@UseGuards(PermissionGuard)
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Put(':id/hired')
	async updateHiredStatus(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ICandidate> {
		return await this.commandBus.execute(
			new CandidateHiredCommand(id)
		);
	}

	/**
	 * Rejected candidate user
	 * UPDATE Candidate By Id
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Update candidate status as Rejected' })
	@ApiResponse({
		status: HttpStatus.OK,
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
	@UseGuards(PermissionGuard)
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Put(':id/rejected')
	async updateRejectedStatus(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ICandidate> {
		return await this.commandBus.execute(
			new CandidateRejectedCommand(id)
		);
	}
}
