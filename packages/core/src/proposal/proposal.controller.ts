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
import { ProposalService } from './proposal.service';
import { Proposal } from './proposal.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IProposalCreateInput, IProposal } from '@gauzy/contracts';
import { IPagination } from '../core';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { AuthGuard } from '@nestjs/passport';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Proposal')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProposalController extends CrudController<Proposal> {
	constructor(private readonly proposalService: ProposalService) {
		super(proposalService);
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get()
	async findAllProposals(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IProposal>> {
		const { relations, findInput, filterDate } = data;
		return await this.proposalService.getAllProposals(
			{ where: findInput, relations },
			filterDate
		);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PROPOSALS_VIEW)
	@Get(':id')
	async findOne(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IProposal> {
		const { relations, findInput } = data;
		return this.proposalService.findOne(id, {
			where: findInput,
			relations
		});
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
	@Permissions(PermissionsEnum.ORG_PROPOSALS_EDIT)
	@Post('/create')
	async createOrganizationTeam(
		@Body() entity: IProposalCreateInput,
		...options: any[]
	): Promise<Proposal> {
		return this.proposalService.create(entity);
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PROPOSALS_EDIT)
	@Put(':id')
	async updateProposal(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: any
	): Promise<any> {
		return this.proposalService.create({
			id,
			...entity
		});
	}
}
