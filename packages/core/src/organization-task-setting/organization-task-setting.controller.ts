import { Body, Controller, HttpCode, HttpStatus, Param, Put, UseGuards, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IOrganizationTaskSetting,
	IOrganizationTaskSettingCreateInput,
	IOrganizationTaskSettingUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { CommandBus } from '@nestjs/cqrs';
import { CrudController } from './../core/crud';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationTaskSettingUpdateCommand } from './commands';

@ApiTags('OrganizationTaskSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_TASK_SETTING)
@Controller()
export class OrganizationTaskSettingController extends CrudController<OrganizationTaskSetting> {
	constructor(
		private readonly organizationTaskSettingService: OrganizationTaskSettingService,
		private readonly commandBus: CommandBus
	) {
		super(organizationTaskSettingService);
	}

	/**
	 * CREATE organization task setting
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({
		summary: 'Create new record'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.OK)
	@Post()
	async create(@Body() body: IOrganizationTaskSettingCreateInput): Promise<IOrganizationTaskSetting> {
		return await this.organizationTaskSettingService.create(body);
	}

	/**
	 * UPDATE organization tasks setting
	 *
	 * @param id
	 * @param body
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
		@Param('id', UUIDValidationPipe) id: IOrganizationTaskSetting['id'],
		@Body() body: IOrganizationTaskSettingUpdateInput
	): Promise<IOrganizationTaskSetting> {
		return this.commandBus.execute(new OrganizationTaskSettingUpdateCommand(id, body));
	}
}
