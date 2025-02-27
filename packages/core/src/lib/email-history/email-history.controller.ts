import { Controller, HttpStatus, Get, Query, UseGuards, Body, Param, Put, HttpCode, Post } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiInternalServerErrorResponse,
	ApiOkResponse,
	ApiNotFoundResponse
} from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { ID, IEmailHistory, IPagination, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
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
@Controller('/email')
export class EmailHistoryController {
	constructor(private readonly _emailHistoryService: EmailHistoryService, private readonly commandBus: CommandBus) {}

	/**
	 * Retrieves all sent emails for a specific tenant with pagination.
	 *
	 * @param params - Pagination and filter parameters.
	 * @returns A paginated list of email histories.
	 */
	@ApiOperation({ summary: 'Find all sent emails under specific tenant.' })
	@ApiOkResponse({
		description: 'Found emails',
		type: EmailHistory
	})
	@ApiNotFoundResponse({
		description: 'No records found'
	})
	@ApiInternalServerErrorResponse({
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EmailHistory>): Promise<IPagination<IEmailHistory>> {
		return await this._emailHistoryService.findAll(params);
	}

	/**
	 * Update an existing email history record.
	 *
	 * @param id - The UUID of the record to update.
	 * @param entity - The update payload.
	 * @returns The updated email history record or update result.
	 * @throws NotFoundException if no record exists with the given ID.
	 * @throws BadRequestException if the update fails due to invalid input.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEmailHistoryDTO
	): Promise<IEmailHistory | UpdateResult> {
		return await this._emailHistoryService.update(id, entity);
	}

	/**
	 * Resend an email invitation.
	 *
	 * @param entity - The DTO containing the email details to be resent.
	 * @param languageCode - The language code to determine the email content language.
	 * @returns The update result or updated email history record.
	 */
	@ApiOperation({ summary: 'Resend Email.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong.'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Post('/resend/:id')
	@UseValidationPipe()
	async resendInvite(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ResendEmailHistoryDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<UpdateResult | IEmailHistory> {
		return await this.commandBus.execute(new EmailHistoryResendCommand(id, entity, languageCode));
	}
}
