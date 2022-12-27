import { PermissionsEnum, IPagination, IOrganizationTeam } from '@gauzy/contracts';
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
	UsePipes,
	ValidationPipe,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { CrudController, PaginationParams } from './../core/crud';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { GetOrganizationTeamStatisticQuery } from './queries';
import { CreateOrganizationTeamDTO, OrganizationTeamStatisticDTO, UpdateOrganizationTeamDTO } from './dto';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';

@ApiTags('OrganizationTeam')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationTeamController extends CrudController<OrganizationTeam> {

	constructor(
		private readonly queryBus: QueryBus,
		private readonly organizationTeamService: OrganizationTeamService,
	) {
		super(organizationTeamService);
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
	@Get('me')
	@UsePipes(new ValidationPipe())
	async findMyTeams(
		@Query() params: PaginationParams<OrganizationTeam>
	): Promise<IPagination<IOrganizationTeam>> {
		return await this.organizationTeamService.findMyTeams(params);
	}

	/**
	 * GET organization team count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('count')
	@UsePipes(new ValidationPipe())
	async getCount(
		@Query() options: CountQueryDTO<OrganizationTeam>
	): Promise<number> {
		return await this.organizationTeamService.countBy(options);
	}

	/**
	 * GET organization teams by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() params: PaginationParams<OrganizationTeam>
	): Promise<IPagination<IOrganizationTeam>> {
		return await this.organizationTeamService.pagination(params);
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
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<OrganizationTeam>
	): Promise<IPagination<IOrganizationTeam>> {
		return await this.organizationTeamService.findAll(params);
	}

	/**
	 * Find team by primary ID
	 *
	 * @param id
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	@Get(':id')
	@UsePipes(new ValidationPipe())
	async findById(
		@Param('id', UUIDValidationPipe) id: IOrganizationTeam['id'],
		@Query() options: OrganizationTeamStatisticDTO
	): Promise<any> {
		return await this.queryBus.execute(
			new GetOrganizationTeamStatisticQuery(
				id,
				options
			)
		);
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
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(
		@Body() entity: CreateOrganizationTeamDTO
	): Promise<IOrganizationTeam> {
		return await this.organizationTeamService.create(entity);
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
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganizationTeam['id'],
		@Body() entity: UpdateOrganizationTeamDTO
	): Promise<IOrganizationTeam> {
		return await this.organizationTeamService.update(id, entity);
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
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IOrganizationTeam['id']
	): Promise<DeleteResult> {
		return await this.organizationTeamService.delete(id);
	}
}
