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
	ICandidateCreateInput,
	LanguagesEnum,
	ICandidate,
	ICandidateUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { getUserDummyImage } from '../core/utils';
import { CrudController, PaginationParams} from './../core/crud';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import {
	CandidateCreateCommand,
	CandidateBulkCreateCommand,
	CandidateUpdateCommand
} from './commands';
import { TransformInterceptor } from './../core/interceptors';

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
		description: 'Records have been successfully created.' /*, type: T*/
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
		@Body() body: ICandidateCreateInput[],
		@I18nLang() languageCode: LanguagesEnum,
		...options: any[]
	): Promise<ICandidate[]> {
		/**
		* Use a dummy image avatar if no image is uploaded for any of the Candidate in the list
		*/
		 body
			.filter((entity) => !entity.user.imageUrl)
			.forEach(
				(entity) =>
					(entity.user.imageUrl = getUserDummyImage(entity.user))
			);

		return await this.commandBus.execute(
			new CandidateBulkCreateCommand(body, languageCode)
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
		@Query() filter: PaginationParams<ICandidate>
	): Promise<number> {
        return await this.candidateService.count(filter);
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
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ICandidate>
	): Promise<IPagination<ICandidate>> {
		return this.candidateService.paginate(filter);
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
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<ICandidate> {
		const { relations = [] } = data;
		return this.candidateService.findOne(id, {
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
	async create(
		@Body() body: ICandidateCreateInput,
		...options: any[]
	): Promise<ICandidate> {
		return await this.commandBus.execute(new CandidateCreateCommand(body));
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ICandidateUpdateInput
	): Promise<ICandidate> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		return await this.commandBus.execute(
			new CandidateUpdateCommand({ id, ...entity })
		);
	}
}
