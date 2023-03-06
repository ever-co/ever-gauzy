import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ICustomSmtp, PermissionsEnum } from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';
import { CrudController } from './../core/crud';
import { CreateCustomSmtpDTO, CustomSmtpQueryDTO, UpdateCustomSmtpDTO, ValidateCustomSmtpDTO } from './dto';

@ApiTags('CustomSmtp')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
@Controller()
export class CustomSmtpController extends CrudController<CustomSmtp> {
	constructor(private readonly customSmtpService: CustomSmtpService, private readonly commandBus: CommandBus) {
		super(customSmtpService);
	}

	/**
	 * GET smtp setting for tenant
	 *
	 * @param query
	 * @returns
	 */
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
	@Get('setting')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getSmtpSetting(@Query() query: CustomSmtpQueryDTO): Promise<ICustomSmtp | ISMTPConfig> {
		return await this.customSmtpService.getSmtpSetting(query);
	}

	/**
	 * CREATE verify smtp transporter
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Validate new record' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('validate')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async validateSmtpSetting(@Body() entity: ValidateCustomSmtpDTO): Promise<Boolean | any> {
		return await this.customSmtpService.verifyTransporter(entity);
	}

	/**
	 * CREATE custom smtp for tenant/organization
	 *
	 * @param entity
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(@Body() entity: CreateCustomSmtpDTO): Promise<ICustomSmtp> {
		return await this.commandBus.execute(new CustomSmtpCreateCommand(entity));
	}

	/**
	 * UPDATE smtp by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: ICustomSmtp['id'],
		@Body() entity: UpdateCustomSmtpDTO
	): Promise<ICustomSmtp> {
		return await this.commandBus.execute(new CustomSmtpUpdateCommand({ id, ...entity }));
	}
}
