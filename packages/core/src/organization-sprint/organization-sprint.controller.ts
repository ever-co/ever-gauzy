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
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationSprint>> {
		const { relations, findInput } = data;
		return this.organizationSprintService.findAll({
			where: findInput,
			relations
		});
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_SPRINT_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<OrganizationSprint>
	): Promise<IOrganizationSprint> {
		return await this.organizationSprintService.findOneByIdString(id, params);
	}

	/**
	 * CREATE organization sprint
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
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
	@ApiOperation({ summary: 'Update an existing record' })
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	@UseValidationPipe()
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationSprintDTO
	): Promise<IOrganizationSprint> {
		return this.commandBus.execute(new OrganizationSprintUpdateCommand(id, entity));
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.organizationSprintService.delete(id);
	}
}
