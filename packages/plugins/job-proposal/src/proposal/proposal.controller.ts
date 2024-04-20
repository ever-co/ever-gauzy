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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IProposal, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	PaginationParams,
	ParseJsonPipe,
	UUIDValidationPipe,
	OptionParams
} from '@gauzy/core';
import { ProposalCreateCommand, ProposalUpdateCommand } from './commands';
import { ProposalService } from './proposal.service';
import { Proposal } from './proposal.entity';
import { CreateProposalDTO, UpdateProposalDTO } from './dto';

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
	 * Get proposals using pagination.
	 *
	 * @param params The pagination parameters.
	 * @returns The paginated list of proposals.
	 */
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@ApiOperation({ summary: 'Get proposals by pagination' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Proposals retrieved successfully',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid pagination parameters provided',
	})
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Proposal>): Promise<IPagination<IProposal>> {
		return await this._proposalService.pagination(params);
	}

	/**
	* Find all proposals based on the provided options.
	*
	* @param data The options for finding proposals.
	* @returns The found proposals.
	*/
	@ApiOperation({ summary: 'Find all proposals' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Proposals found',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No proposals found',
	})
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IProposal>> {
		const { relations, findInput, filterDate } = data;
		return await this._proposalService.getAllProposals({ where: findInput, relations }, filterDate);
	}

	/**
	 * Find a single proposal by its ID.
	 *
	 * @param id The ID of the proposal to find.
	 * @param options Additional options for the query.
	 * @returns The found proposal.
	 */
	@ApiOperation({ summary: 'Find a single proposal by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Proposal found',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Proposal not found',
	})
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query() options: OptionParams<Proposal>,
	): Promise<IProposal> {
		return await this._proposalService.findOneByIdString(id, { relations: options.relations || [] });
	}

	/**
	 * Create a new proposal record.
	 *
	 * @param entity The data to create the proposal.
	 * @returns The newly created proposal.
	 */
	@ApiOperation({ summary: 'Create a new proposal record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Proposal created successfully',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong',
	})
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProposalDTO): Promise<IProposal> {
		return await this._commandBus.execute(
			new ProposalCreateCommand(entity),
		);
	}

	/**
	 * Update a single proposal by its ID.
	 *
	 * @param id The ID of the proposal to update.
	 * @param entity The updated proposal data.
	 * @returns The updated proposal.
	 */
	@ApiOperation({ summary: 'Update a single proposal by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Proposal updated successfully',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Proposal not found',
	})
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateProposalDTO,
	): Promise<IProposal> {
		return await this._commandBus.execute(
			new ProposalUpdateCommand(id, entity),
		);
	}
}
