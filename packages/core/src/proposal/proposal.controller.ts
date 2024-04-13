import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	UseGuards,
	Put,
	Param
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IProposal, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateProposalDTO, UpdateProposalDTO } from './dto';
import { ProposalService } from './proposal.service';
import { Proposal } from './proposal.entity';
import { ProposalCreateCommand, ProposalUpdateCommand } from './commands';

@ApiTags('Proposal')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PROPOSALS_EDIT)
@Controller('/proposal')
export class ProposalController extends CrudController<Proposal> {

	constructor(
		private readonly _proposalService: ProposalService,
		private readonly _commandBus: CommandBus
	) {
		super(_proposalService);
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
		return await this._proposalService.pagination(params);
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
		return await this._proposalService.getAllProposals({ where: findInput, relations }, filterDate);
	}

	/**
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
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
		return await this._proposalService.findOneByIdString(id, { relations: options.relations || [] });
	}

	/**
	 *
	 * @param entity
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
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProposalDTO): Promise<IProposal> {
		return await this._commandBus.execute(
			new ProposalCreateCommand(entity)
		);
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
	): Promise<IProposal> {
		return await this._commandBus.execute(
			new ProposalUpdateCommand(id, entity)
		);
	}
}
