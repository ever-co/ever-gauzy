import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	Param,
	Put,
	HttpCode,
	BadRequestException,
	Post
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiInternalServerErrorResponse,
	ApiOkResponse,
	ApiNotFoundResponse
} from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IEmailHistory, IPagination, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryService } from './email-history.service';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UpdateEmailHistoryDTO } from './dto';
import { PaginationParams } from './../core/crud';
import { ResendEmailHistoryDTO } from './dto/resend-email-history.dto';
import { CommandBus } from '@nestjs/cqrs';
import { EmailHistoryResendCommand } from './commands';

@ApiTags('Email')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
@Controller()
export class EmailHistoryController {
	constructor(private readonly _emailHistoryService: EmailHistoryService, private readonly commandBus: CommandBus) { }

	@ApiOperation({ summary: 'Find all sent emails under specific tenant.' })
	@ApiOkResponse({
		status: HttpStatus.OK,
		description: 'Found emails',
		type: EmailHistory
	})
	@ApiNotFoundResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@ApiInternalServerErrorResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EmailHistory>): Promise<IPagination<IEmailHistory>> {
		try {
			return await this._emailHistoryService.findAll(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

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
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IEmailHistory['id'],
		@Body() entity: UpdateEmailHistoryDTO
	): Promise<IEmailHistory | UpdateResult> {
		try {
			return await this._emailHistoryService.update(id, entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@ApiOperation({ summary: 'Resend Email.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Post('resend')
	@UseValidationPipe()
	async resendInvite(
		@Body() entity: ResendEmailHistoryDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<UpdateResult | IEmailHistory> {
		return await this.commandBus.execute(new EmailHistoryResendCommand(entity, languageCode));
	}
}
