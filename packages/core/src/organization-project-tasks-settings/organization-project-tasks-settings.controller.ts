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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationProjectTasksSettings } from './organization-project-tasks-settings.entity';
import { CommandBus } from '@nestjs/cqrs';
import { CrudController } from '../core/crud';
import { OrganizationProjectTasksSettingsService } from './organization-project-tasks-settings.service';
import {
	IOrganizationProjectTasksSettings,
	IOrganizationProjectTasksSettingsUpdateInput,
	IPagination,
} from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from '../shared/pipes';
import { TenantPermissionGuard } from '../shared/guards';
import { OrganizationProjectTasksSettingsUpdateCommand } from './commands';

@ApiTags('OrganizationProjectTasksSettings')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationProjectTasksSettingsController extends CrudController<OrganizationProjectTasksSettings> {
	constructor(
		private readonly organizationProjectTasksSettingsService: OrganizationProjectTasksSettingsService,
		private readonly commandBus: CommandBus
	) {
		super(organizationProjectTasksSettingsService);
	}

	/**
	 * GET all organization project task settings
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization sprint.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization project task settings',
		type: OrganizationProjectTasksSettings,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationProjectTasksSettings>> {
		const { relations, findInput } = data;
		return this.organizationProjectTasksSettingsService.findAll({
			where: findInput,
			relations,
		});
	}

	/**
	 * CREATE organization project task settings
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@Post()
	async create(
		@Body() body: OrganizationProjectTasksSettings,
		...options: any[]
	): Promise<OrganizationProjectTasksSettings> {
		return this.organizationProjectTasksSettingsService.create(body);
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
		description: 'The record has been successfully edited.',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: IOrganizationProjectTasksSettingsUpdateInput
	): Promise<OrganizationProjectTasksSettings> {
		return this.commandBus.execute(
			new OrganizationProjectTasksSettingsUpdateCommand(id, body)
		);
	}
}
