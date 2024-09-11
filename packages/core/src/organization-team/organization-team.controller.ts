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
	UseGuards,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PermissionsEnum, IPagination, IOrganizationTeam, IUser, ID } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO, DeleteQueryDTO } from './../shared/dto';
import { GetOrganizationTeamStatisticQuery } from './queries';
import { CreateOrganizationTeamDTO, OrganizationTeamStatisticDTO, UpdateOrganizationTeamDTO } from './dto';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';
import { OrganizationTeamCreateCommand } from './commands';

@ApiTags('OrganizationTeam')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
@Controller('/organization-team')
export class OrganizationTeamController extends CrudController<OrganizationTeam> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _queryBus: QueryBus,
		private readonly _organizationTeamService: OrganizationTeamService
	) {
		super(_organizationTeamService);
	}

	/**
	 * GET find my organization teams
	 *
	 * @param data
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('/me')
	@UseValidationPipe()
	async findMyTeams(@Query() params: PaginationParams<OrganizationTeam>): Promise<IPagination<IOrganizationTeam>> {
		return await this._organizationTeamService.findMyTeams(params);
	}

	/**
	 * GET organization team count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('/count')
	@UseValidationPipe()
	async getCount(@Query() options: CountQueryDTO<OrganizationTeam>): Promise<number> {
		return await this._organizationTeamService.countBy(options);
	}

	/**
	 * GET organization teams by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<OrganizationTeam>): Promise<IPagination<IOrganizationTeam>> {
		return await this._organizationTeamService.pagination(params);
	}

	/**
	 * GET organization teams
	 *
	 * @param params
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<OrganizationTeam>): Promise<IPagination<IOrganizationTeam>> {
		return await this._organizationTeamService.findAll(params);
	}

	/**
	 * Find team by primary ID
	 *
	 * @param id - The primary ID of the organization team.
	 * @param query - Query parameters for team statistics.
	 * @returns The result of the team statistics query.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('/:id')
	@UseValidationPipe({ transform: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: OrganizationTeamStatisticDTO
	): Promise<IOrganizationTeam> {
		return await this._queryBus.execute(new GetOrganizationTeamStatisticQuery(id, options));
	}

	/**
	 * CREATE organization team
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
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_ADD)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateOrganizationTeamDTO): Promise<IOrganizationTeam> {
		return await this._commandBus.execute(new OrganizationTeamCreateCommand(entity));
	}

	/**
	 * UPDATE organization team by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationTeamDTO
	): Promise<IOrganizationTeam> {
		return await this._organizationTeamService.update(id, entity);
	}

	/**
	 * Delete organization team
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete organization team' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE)
	@Delete('/:id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) teamId: ID,
		@Query() options: DeleteQueryDTO<OrganizationTeam>
	): Promise<DeleteResult | IOrganizationTeam> {
		return await this._organizationTeamService.deleteTeam(teamId, options);
	}

	/**
	 * Exist from teams where users joined as a team members.
	 *
	 * @param userId
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER)
	@Delete('/teams/:userId')
	async existTeamsAsMember(@Param('userId', UUIDValidationPipe) userId: ID) {
		return await this._organizationTeamService.existTeamsAsMember(userId);
	}
}
