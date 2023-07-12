import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UseGuards,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { CommandBus } from '@nestjs/cqrs';
import { Permissions } from './../shared/decorators';
import { CrudController } from './../core/crud';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import {
	IOrganizationTaskSettingUpdateInput,
	PermissionsEnum,
} from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { OrganizationTaskSettingUpdateCommand } from './commands';

@ApiTags('OrganizationTaskSetting')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationTaskSettingController extends CrudController<OrganizationTaskSetting> {
	constructor(
		private readonly organizationTaskSettingService: OrganizationTaskSettingService,
		private readonly commandBus: CommandBus
	) {
		super(organizationTaskSettingService);
	}

	/**
	 * CREATE organization task settings
	 *
	 * @param entity
	 * @param options
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
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Post()
	async create(
		@Body() body: OrganizationTaskSetting,
		...options: any[]
	): Promise<OrganizationTaskSetting> {
		return this.organizationTaskSettingService.create(body);
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
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: IOrganizationTaskSettingUpdateInput
	): Promise<OrganizationTaskSetting> {
		return this.commandBus.execute(
			new OrganizationTaskSettingUpdateCommand(id, body)
		);
	}
}
