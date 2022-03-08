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
	UseInterceptors,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ICustomSmtp,
	ICustomSmtpFindInput
} from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';
import { CrudController } from './../core/crud';
import { TransformInterceptor } from './../core/interceptors';
import { CustomSmtpDTO } from './dto';

@ApiTags('CustomSmtp')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(TransformInterceptor)
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
	@Post('validate')
	@UsePipes(new ValidationPipe({ transform: true }))
	async validateSmtpSetting(
		@Body() entity: CustomSmtpDTO
	) {
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
	@Post()
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async create(
		@Body() entity: CustomSmtpDTO
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
	@Put(':id')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CustomSmtpDTO
	): Promise<ICustomSmtp> {
		return await this.commandBus.execute(
			new CustomSmtpUpdateCommand({ id, ...entity })
		);
	}
}
