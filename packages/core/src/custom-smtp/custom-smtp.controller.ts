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
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ICustomSmtp,
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput,
	ICustomSmtpUpdateInput
} from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { CrudController } from './../core/crud';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';

@ApiTags('CustomSmtp')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CustomSmtpController extends CrudController<CustomSmtp> {
	constructor(
		private readonly customSmtpService: CustomSmtpService,
		private readonly commandBus: CommandBus
	) {
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
	async smtpSetting(
		@Query() query: ICustomSmtpFindInput
	): Promise<ICustomSmtp | ISMTPConfig> {
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('validate')
	async validateSmtpSetting(@Body() entity: ICustomSmtpCreateInput) {
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	async create(
		@Body() entity: ICustomSmtpCreateInput
	): Promise<ICustomSmtp> {
		return await this.commandBus.execute(
			new CustomSmtpCreateCommand(entity)
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ICustomSmtpUpdateInput
	): Promise<ICustomSmtp> {
		return await this.commandBus.execute(
			new CustomSmtpUpdateCommand({ id, ...entity })
		);
	}
}
