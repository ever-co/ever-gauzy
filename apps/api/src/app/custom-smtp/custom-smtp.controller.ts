import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { UUIDValidationPipe } from '../shared/pipes/uuid-validation.pipe';
import {
	ICustomSmtp,
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput,
	ICustomSmtpUpdateInput
} from '@gauzy/models';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { CommandBus } from '@nestjs/cqrs';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';
import { ISMTPConfig } from '../../environments/ISMTPConfig';

@ApiTags('CustomSmtp')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CustomSmtpController extends CrudController<CustomSmtp> {
	constructor(
		private readonly customSmtpService: CustomSmtpService,
		private readonly commandBus: CommandBus
	) {
		super(customSmtpService);
	}

	@ApiOperation({ summary: 'Find smtp setting for tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tenant setting',
		type: CustomSmtp
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async tenantSmtpSetting(
		@Query() query: ICustomSmtpFindInput
	): Promise<ICustomSmtp | ISMTPConfig> {
		return this.customSmtpService.getSmtpSetting(query);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	async createSmtpSetting(
		@Body() entity: ICustomSmtpCreateInput
	): Promise<ICustomSmtp> {
		return this.commandBus.execute(new CustomSmtpCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update record' })
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async updateSmtpSetting(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ICustomSmtpUpdateInput
	): Promise<ICustomSmtp> {
		return this.commandBus.execute(
			new CustomSmtpUpdateCommand({ id, ...entity })
		);
	}

	@ApiOperation({ summary: 'Validate new record' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('validate')
	async validateSmtpSetting(@Body() entity: ICustomSmtpCreateInput) {
		return await this.customSmtpService.verifyTransporter(entity);
	}
}
