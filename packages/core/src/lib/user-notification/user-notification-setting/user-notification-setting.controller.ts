import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { CrudController, PaginationParams } from '../../core/crud';
import { UserNotificationSetting } from './user-notification-setting.entity';
import { UserNotificationSettingService } from './user-notification-setting.service';
import { UserNotificationSettingCreateCommand, UserNotificationSettingUpdateCommand } from './commands';
import { CreateUserNotificationSettingDTO, UpdateUserNotificationSettingDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/user-notification-setting')
export class UserNotificationSettingController extends CrudController<UserNotificationSetting> {
	constructor(
		readonly userNotificationSettingService: UserNotificationSettingService,
		private readonly commandBus: CommandBus
	) {
		super(userNotificationSettingService);
	}

	@ApiOperation({ summary: 'Get users notification settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found user notification settings',
		type: UserNotificationSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get()
	async findAll(
		@Query() params: PaginationParams<UserNotificationSetting>
	): Promise<IPagination<UserNotificationSetting>> {
		return this.userNotificationSettingService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found user notification setting',
		type: UserNotificationSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<UserNotificationSetting>
	): Promise<UserNotificationSetting> {
		return this.userNotificationSettingService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create user notification setting.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateUserNotificationSettingDTO): Promise<UserNotificationSetting> {
		return await this.commandBus.execute(new UserNotificationSettingCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update user notification setting.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
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
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateUserNotificationSettingDTO
	): Promise<UserNotificationSetting> {
		return await this.commandBus.execute(new UserNotificationSettingUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete user notification setting.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.userNotificationSettingService.delete(id);
	}
}
