import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IOrganizationSprint, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintCreateCommand, OrganizationSprintUpdateCommand } from './commands';
import { ParseJsonPipe, UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateOrganizationSprintDTO, UpdateOrganizationSprintDTO } from './dto';

@ApiTags('OrganizationSprint')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationSprintController extends CrudController<OrganizationSprint> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService,
		private readonly commandBus: CommandBus
	) {
		super(organizationSprintService);
	}

	/**
	 * GET all organization sprints
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization sprint.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization sprints',
		type: OrganizationSprint
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationSprint>> {
		const { relations, findInput } = data;
		return this.organizationSprintService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE organization sprint
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@UseValidationPipe()
	@Post()
	async create(@Body() entity: CreateOrganizationSprintDTO): Promise<IOrganizationSprint> {
		return await this.commandBus.execute(new OrganizationSprintCreateCommand(entity));
	}

	/**
	 * UPDATE organization sprint by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@UseValidationPipe()
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdateOrganizationSprintDTO
	): Promise<IOrganizationSprint> {
		return this.commandBus.execute(new OrganizationSprintUpdateCommand(id, body));
	}
}
