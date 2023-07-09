import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationTasksSettings } from './organization-tasks-settings.entity';
import { CommandBus } from '@nestjs/cqrs';
import { CrudController } from './../core/crud';
import { OrganizationTasksSettingsService } from './organization-tasks-settings.service';
import { IOrganizationTasksSettings, IOrganizationTasksSettingsUpdateInput, IPagination } from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { OrganizationTasksSettingsUpdateCommand } from './commands';

@ApiTags('OrganizationTasksSettings')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationTasksSettingsController extends CrudController<OrganizationTasksSettings> {
	constructor(
		private readonly organizationTasksSettingsService: OrganizationTasksSettingsService,
		private readonly commandBus: CommandBus
	) {
		super(organizationTasksSettingsService);
	}

	/**
	 * GET all organization task settings
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization sprint.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization task settings',
		type: OrganizationTasksSettings
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationTasksSettings>> {
		const { relations, findInput } = data;
		return this.organizationTasksSettingsService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE organization task settings
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
	@Post()
	async create(@Body() body: OrganizationTasksSettings, ...options: any[]): Promise<OrganizationTasksSettings> {
		return this.organizationTasksSettingsService.create(body);
	}

	/**
	 * UPDATE organization tasks settings
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
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: IOrganizationTasksSettingsUpdateInput
	): Promise<OrganizationTasksSettings> {
		return this.commandBus.execute(new OrganizationTasksSettingsUpdateCommand(id, body));
	}
}
