import {
	Controller,
	Get,
	HttpStatus,
	Query,
	Post,
	Body,
	HttpCode,
	Put,
	Param
} from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationTeamsService } from './organization-teams.service';
import { IPagination } from '../core';
import {
	OrganizationTeamCreateInput as IOrganizationTeamCreateInput,
	OrganizationTeams as IIOrganizationTeams
} from '@gauzy/models';
import { OrganizationTeams } from './organization-teams.entity';
import { UpdateResult } from 'typeorm';

@ApiUseTags('Organization-Teams')
@Controller()
export class OrganizationTeamsController extends CrudController<
	OrganizationTeams
> {
	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService
	) {
		super(organizationTeamsService);
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
		@Body() entity: IOrganizationTeamCreateInput,
		...options: any[]
	): Promise<OrganizationTeams> {
		return this.organizationTeamsService.createOrgTeam(entity);
	}

	@ApiOperation({
		title: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeams
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllOrganizationTeams(
		@Query('data') data: string
	): Promise<IPagination<IIOrganizationTeams>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationTeamsService.getAllOrgTeams({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ title: 'Update an organization Team' })
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
	async updateOrganizationTeam(
		@Param('id') id: string,
		@Body() entity: IOrganizationTeamCreateInput,
		...options: any[]
	): Promise<OrganizationTeams> {
		return this.organizationTeamsService.updateOrgTeam(id, entity);
	}
}
