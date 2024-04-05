import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	UseGuards,
	Put,
	Param,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IProposal, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { ProposalService } from './proposal.service';
import { Proposal } from './proposal.entity';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateProposalDTO, UpdateProposalDTO } from './dto';

@ApiTags('Proposal')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PROPOSALS_EDIT)
@Controller()
export class ProposalController extends CrudController<Proposal> {
	constructor(private readonly proposalService: ProposalService) {
		super(proposalService);
	}

	/**
	 * GET proposal by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Proposal>): Promise<IPagination<IProposal>> {
		return this.proposalService.pagination(params);
	}

	/**
	 * GET proposal by find options
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all proposals.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found proposals',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IProposal>> {
		const { relations, findInput, filterDate } = data;
		return await this.proposalService.getAllProposals({ where: findInput, relations }, filterDate);
	}

	@ApiOperation({ summary: 'Find single proposal by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found proposal',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query() options: OptionParams<Proposal>
	): Promise<IProposal> {
		return await this.proposalService.findOneByIdString(id, {
			relations: options.relations || []
		});
	}

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
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProposalDTO): Promise<IProposal> {
		try {
			return await this.proposalService.create(entity);
		} catch (error) {
			throw new BadRequestException();
		}
	}

	/**
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update single proposal by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Updates proposal',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateProposalDTO
	): Promise<IProposal | UpdateResult> {
		try {
			return await this.proposalService.update(id, entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
