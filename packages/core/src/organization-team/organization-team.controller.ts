import {
	Controller,
	Get,
	HttpStatus,
	Query,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationTeamService } from './organization-team.service';
import { IPagination } from '../core';
import {
	IOrganizationTeamCreateInput,
	IOrganizationTeam as IIOrganizationTeam
} from '@gauzy/contracts';
import { OrganizationTeam } from './organization-team.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationTeam')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class OrganizationTeamController extends CrudController<OrganizationTeam> {
	constructor(
		private readonly organizationTeamService: OrganizationTeamService
	) {
		super(organizationTeamService);
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
	@Post('/create')
	async createOrganizationTeam(
		@Body() entity: IOrganizationTeamCreateInput,
		...options: any[]
	): Promise<OrganizationTeam> {
		return this.organizationTeamService.createOrgTeam(entity);
	}

	@ApiOperation({
		summary: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeam
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllOrganizationTeams(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IIOrganizationTeam>> {
		const { relations, findInput } = data;
		return this.organizationTeamService.getAllOrgTeams({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Update an organization Team' })
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IOrganizationTeamCreateInput,
		...options: any[]
	): Promise<OrganizationTeam> {
		return this.organizationTeamService.updateOrgTeam(id, entity);
	}

	@ApiOperation({
		summary: 'Find all organization Teams.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Teams',
		type: OrganizationTeam
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('me')
	async findMyTeams(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IIOrganizationTeam>> {
		const { relations, findInput, employeeId } = data;
		return this.organizationTeamService.findMyTeams(
			relations,
			findInput,
			employeeId
		);
	}
}
