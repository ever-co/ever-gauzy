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
	OrganizationTeamCreateInput as IOrganizationTeamCreateInput,
	OrganizationTeam as IIOrganizationTeam,
	OrganizationTeamEmployee
} from '@gauzy/models';
import { OrganizationTeam } from './organization-team.entity';
import { AuthGuard } from '@nestjs/passport';
import { EmployeeService } from '../employee/employee.service';
import { RequestContext } from '../core/context';

@ApiTags('Organization-Teams')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationTeamController extends CrudController<
	OrganizationTeam
> {
	constructor(
		private readonly organizationTeamService: OrganizationTeamService,
		private readonly employeeService: EmployeeService
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
		@Query('data') data: string
	): Promise<IPagination<IIOrganizationTeam>> {
		const { relations, findInput } = JSON.parse(data);

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
		@Param('id') id: string,
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
		@Query('data') data: string
	): Promise<IPagination<IIOrganizationTeam>> {
		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			where: {
				user: { id: RequestContext.currentUser().id }
			}
		});
		const { relations, findInput } = JSON.parse(data);

		return this.organizationTeamService.getMyOrgTeams(
			{
				where: findInput,
				relations
			},
			employee.id
		);
	}
}
