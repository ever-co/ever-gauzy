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
	ICustomSmtpUpdateInput
} from '@gauzy/models';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('CustomSmtp')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CustomSmtpController extends CrudController<CustomSmtp> {
	constructor(private readonly customSmtpService: CustomSmtpService) {
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
	@Get('tenant')
	async tenantSmtpSetting(
		@Query('tenantId', UUIDValidationPipe) tenantId: string
	): Promise<ICustomSmtp> {
		return this.customSmtpService.getTenantSmtpSetting(tenantId);
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
	@Post('tenant')
	async createTenantSetting(
		@Body() entity: ICustomSmtpCreateInput
	): Promise<ICustomSmtp> {
		return this.customSmtpService.create(entity);
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
	@Put('tenant/:id')
	async updateTenantSetting(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ICustomSmtpUpdateInput
	): Promise<ICustomSmtp> {
		this.customSmtpService.create({
			id,
			...entity
		});
		return this.customSmtpService.findOne(id);
	}
}
