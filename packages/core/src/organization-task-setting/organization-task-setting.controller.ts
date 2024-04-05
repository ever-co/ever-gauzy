import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UseGuards,
	Post,
	Get,
	Query,
	HttpException
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IOrganizationTaskSetting, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { OrganizationTaskSettingCreateCommand, OrganizationTaskSettingUpdateCommand } from './commands';
import { CreateOrganizationTaskSettingDTO, UpdateOrganizationTaskSettingDTO } from './dto';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import { TenantOrganizationBaseDTO } from 'core/dto';

@ApiTags('OrganizationTaskSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationTaskSettingController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationTaskSettingService: OrganizationTaskSettingService
	) { }

	/**
	 * GET organization Task Setting by organizationId
	 *
	 * @param organizationId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find organization task setting by organizationId.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Organization Task Setting',
		type: OrganizationTaskSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_SETTING)
	@Get('organization')
	@UseValidationPipe()
	async findByOrganizationId(@Query() query: TenantOrganizationBaseDTO): Promise<IOrganizationTaskSetting> {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.organizationId) {
				throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
			}

			return await this.organizationTaskSettingService.findByOrganization(query);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Error while retrieving organization task settings: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
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
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() body: CreateOrganizationTaskSettingDTO): Promise<IOrganizationTaskSetting> {
		return await this.commandBus.execute(new OrganizationTaskSettingCreateCommand(body));
	}

	/**
	 * Update an existing organization task setting record.
	 *
	 * @param id - The unique identifier of the organization task setting to be updated.
	 * @param body - The data containing the updates for the organization task setting.
	 * @returns A Promise resolving to the updated organization task setting.
	 *
	 * @throws Throws an HTTP status 404 error if the record is not found.
	 * @throws Throws an HTTP status 400 error for invalid input. The response body may contain clues as to what went wrong.
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
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganizationTaskSetting['id'],
		@Body() body: UpdateOrganizationTaskSettingDTO
	): Promise<IOrganizationTaskSetting> {
		return await this.commandBus.execute(new OrganizationTaskSettingUpdateCommand(id, body));
	}
}
