import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Post,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { PermissionsEnum, LanguagesEnum, ICandidate, IPagination } from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { BulkBodyLoadTransformPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import {
	CandidateCreateCommand,
	CandidateBulkCreateCommand,
	CandidateUpdateCommand,
	CandidateHiredCommand,
	CandidateRejectedCommand
} from './commands';
import { CreateCandidateDTO, UpdateCandidateDTO, CandidateBulkInputDTO } from './dto';

@ApiTags('Candidate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller()
export class CandidateController extends CrudController<Candidate> {
	constructor(private readonly candidateService: CandidateService, private readonly commandBus: CommandBus) {
		super(candidateService);
	}

	/**
	 * CREATE bulk candidate
	 *
	 * @param body
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Create records in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/bulk')
	async createBulk(
		@Body(
			BulkBodyLoadTransformPipe,
			new ValidationPipe({
				transform: true
			})
		)
		entity: CandidateBulkInputDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') originUrl: string
	): Promise<ICandidate[]> {
		return await this.commandBus.execute(
			new CandidateBulkCreateCommand(entity.list, themeLanguage || languageCode, originUrl)
		);
	}

	/**
	 * GET candidate counts
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidates counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates count'
	})
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Candidate>): Promise<number> {
		return await this.candidateService.countBy(options);
	}

	/**
	 * GET candidates by pagination
	 *
	 * @param options
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: PaginationParams<Candidate>): Promise<IPagination<ICandidate>> {
		return await this.candidateService.pagination(options);
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	@UseValidationPipe({ transform: true })
	async findAll(@Query() options: PaginationParams<Candidate>): Promise<IPagination<ICandidate>> {
		return await this.candidateService.findAll(options);
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ICandidate['id'],
		@Query() params: OptionParams<Candidate>
	): Promise<ICandidate> {
		return await this.candidateService.findOneByIdString(id, params);
	}

	/**
	 * CREATE new candidate
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: CreateCandidateDTO,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') originUrl: string
	): Promise<ICandidate> {
		return await this.commandBus.execute(new CandidateCreateCommand(entity, languageCode, originUrl));
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidate['id'],
		@Body() entity: UpdateCandidateDTO
	): Promise<ICandidate> {
		return await this.commandBus.execute(new CandidateUpdateCommand({ id, ...entity }));
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/hired')
	async updateHiredStatus(@Param('id', UUIDValidationPipe) id: ICandidate['id']): Promise<ICandidate> {
		return await this.commandBus.execute(new CandidateHiredCommand(id));
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/rejected')
	async updateRejectedStatus(@Param('id', UUIDValidationPipe) id: ICandidate['id']): Promise<ICandidate> {
		return await this.commandBus.execute(new CandidateRejectedCommand(id));
	}
}
