import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Post,
	Delete
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IOrganizationSprint, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintCreateCommand, OrganizationSprintUpdateCommand } from './commands';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_SPRINT_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<OrganizationSprint>): Promise<IPagination<IOrganizationSprint>> {
		return this.organizationSprintService.findAll(params);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_SPRINT_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<OrganizationSprint>
	): Promise<IOrganizationSprint> {
		return await this.organizationSprintService.findOneByIdString(id, params);
	}

	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@UseValidationPipe()
	@Post()
	async create(@Body() entity: CreateOrganizationSprintDTO): Promise<IOrganizationSprint> {
		return await this.commandBus.execute(new OrganizationSprintCreateCommand(entity));
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@UseValidationPipe()
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationSprintDTO
	): Promise<IOrganizationSprint> {
		return this.commandBus.execute(new OrganizationSprintUpdateCommand(id, entity));
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.organizationSprintService.delete(id);
	}
}
