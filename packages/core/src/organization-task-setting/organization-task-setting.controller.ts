import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UseGuards,
	Post,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IOrganizationTaskSetting, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationTaskSettingCreateCommand, OrganizationTaskSettingUpdateCommand } from './commands';
import { CreateOrganizationTaskSettingDTO, UpdateOrganizationTaskSettingDTO } from './dto';

@ApiTags('OrganizationTaskSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationTaskSettingController {

	constructor(
		private readonly commandBus: CommandBus
	) { }

	/**
	 * CREATE organization task setting
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({
		summary: 'Create new record',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	@Post()
	@UsePipes(new ValidationPipe())
	async create(
		@Body() body: CreateOrganizationTaskSettingDTO
	): Promise<IOrganizationTaskSetting> {
		return this.commandBus.execute(
			new OrganizationTaskSettingCreateCommand(body)
		);
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
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	@Put(':id')
	@UsePipes(new ValidationPipe())
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganizationTaskSetting['id'],
		@Body() body: UpdateOrganizationTaskSettingDTO
	): Promise<IOrganizationTaskSetting> {
		return this.commandBus.execute(
			new OrganizationTaskSettingUpdateCommand(id, body)
		);
	}
}
