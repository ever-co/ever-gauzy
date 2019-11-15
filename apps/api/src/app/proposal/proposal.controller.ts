import { Controller, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProposalService } from './proposal.service';
import { Proposal } from './proposal.entity';
import { CrudController } from '../core/crud/crud.controller';
import {
	ProposalCreateInput as IProposalCreateInput,
	Proposal as IProposal
} from '@gauzy/models';
import { IPagination } from '../core';

@ApiUseTags('Proposal')
@Controller()
export class ProposalController extends CrudController<Proposal> {
	constructor(private readonly proposalService: ProposalService) {
		super(proposalService);
	}

	@ApiOperation({ title: 'Find all proposals.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found proposals',
		type: Proposal
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllProposals(
		@Query('data') data: string
	): Promise<IPagination<IProposal>> {
		const { relations, findInput, filterDate } = JSON.parse(data);

		return this.proposalService.getAllProposals(
			{ where: findInput, relations },
			filterDate
		);
	}

	@ApiOperation({ title: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/create')
	async createOrganizationTeam(
		@Body() entity: IProposalCreateInput,
		...options: any[]
	): Promise<Proposal> {
		return this.proposalService.create(entity);
	}
}
