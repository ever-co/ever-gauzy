import {
	ICreateEmailInvitesOutput,
	IInviteAcceptInput,
	PermissionsEnum,
	LanguagesEnum,
	IOrganizationContactAcceptInviteInput,
	IOrganizationContact,
	IPagination,
	IInvite,
	InviteActionEnum,
	ID
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	UseGuards,
	Delete,
	Param,
	Put,
	Req
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { Public } from '@gauzy/common';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PaginationParams } from './../core/crud';
import {
	InviteAcceptCommand,
	InviteAcceptOrganizationContactCommand,
	InviteBulkCreateCommand,
	InviteOrganizationContactCommand,
	InviteResendCommand
} from './commands';
import { CreateInviteDTO, ResendInviteDTO, ValidateInviteByCodeQueryDTO, ValidateInviteQueryDTO } from './dto';
import { FindInviteByEmailCodeQuery, FindInviteByEmailTokenQuery } from './queries';

@ApiTags('Invite')
@Controller('/invite')
export class InviteController {
	constructor(
		private readonly inviteService: InviteService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * This method handles the creation of multiple email invites.
	 * It receives the invite details and language code from the request body,
	 * validates the input, and uses a command bus to execute the invite creation command.
	 *
	 * @param entity - The data transfer object containing invite details.
	 * @param languageCode - The language code for localization purposes.
	 * @returns A promise that resolves to the output of the email invite creation process.
	 */
	@ApiOperation({ summary: 'Create email invites' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
		type: Invite
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT, PermissionsEnum.ORG_TEAM_ADD)
	@Post('/emails')
	@UseValidationPipe()
	async createManyWithEmailsId(
		@Body() entity: CreateInviteDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<ICreateEmailInvitesOutput> {
		return await this.commandBus.execute(new InviteBulkCreateCommand(entity, languageCode));
	}

	/**
	 * This method handles resending an invite.
	 * It receives the invite details and language code from the request body,
	 * validates the input, and uses a command bus to execute the invite resend command.
	 *
	 * @param entity - The data transfer object containing invite details to be resent.
	 * @param languageCode - The language code for localization purposes.
	 * @returns A promise that resolves to either the update result or the invite entity.
	 */
	@ApiOperation({ summary: 'Resend invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.',
		type: Invite
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('/resend')
	@UseValidationPipe()
	async resendInvite(
		@Body() entity: ResendInviteDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<UpdateResult | Invite> {
		return await this.commandBus.execute(new InviteResendCommand(entity, languageCode));
	}

	/**
	 * Validate invite by token and email
	 *
	 * @param options - The query parameters containing email and token.
	 * @returns A promise that resolves to the invite if found.
	 */
	@ApiOperation({ summary: 'Get invite.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invite',
		type: Invite
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Public()
	@Get('/validate')
	@UseValidationPipe({ whitelist: true })
	async validateInviteByToken(@Query() options: ValidateInviteQueryDTO) {
		return await this.queryBus.execute(
			new FindInviteByEmailTokenQuery({
				email: options.email,
				token: options.token
			})
		);
	}

	/**
	 * Validate invite by code and email
	 *
	 * @param body - The body containing email and code.
	 * @returns A promise that resolves to the invite if found.
	 */
	@ApiOperation({ summary: 'Validate invite by code and email.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invite',
		type: Invite
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Public()
	@Post('/validate-by-code')
	@UseValidationPipe({ whitelist: true })
	async validateInviteByCode(@Body() body: ValidateInviteByCodeQueryDTO) {
		return await this.queryBus.execute(
			new FindInviteByEmailCodeQuery({
				email: body.email,
				code: body.code
			})
		);
	}

	/**
	 * Accept employee/user/candidate invite.
	 *
	 * @param entity - The data transfer object containing invite acceptance details.
	 * @param origin - The origin header from the request.
	 * @param languageCode - The language code for localization purposes.
	 * @returns A promise that resolves to the result of the invite acceptance process.
	 */
	@ApiOperation({ summary: 'Accept employee/user/candidate invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully executed.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Public()
	@Post('/accept')
	async acceptInvitation(
		@Body() entity: IInviteAcceptInput,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum
	) {
		return await this.commandBus.execute(new InviteAcceptCommand({ ...entity, originalUrl: origin }, languageCode));
	}

	/**
	 * Accept organization contact invite.
	 *
	 * @param input - The data transfer object containing invite acceptance details.
	 * @param request - The incoming HTTP request, used to extract the origin header.
	 * @param languageCode - The language code for localization purposes.
	 * @returns A promise that resolves to the result of the invite acceptance process.
	 */
	@ApiOperation({ summary: 'Accept organization contact invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/contact')
	@Public()
	async acceptOrganizationContactInvite(
		@Body() input: IOrganizationContactAcceptInviteInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<any> {
		input.originalUrl = request.get('Origin');
		return await this.commandBus.execute(new InviteAcceptOrganizationContactCommand(input, languageCode));
	}

	/**
	 * Update an existing record
	 *
	 * @param id - The ID of the organization contact to update.
	 * @param request - The incoming HTTP request, used to extract the origin header and the inviter user.
	 * @param languageCode - The language code for localization purposes.
	 * @returns A promise that resolves to the updated organization contact.
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
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Put('/organization-contact/:id')
	async inviteOrganizationContact(
		@Param('id', UUIDValidationPipe) id: ID,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IOrganizationContact> {
		return await this.commandBus.execute(
			new InviteOrganizationContactCommand({
				id,
				originalUrl: request.get('Origin'),
				inviterUser: request.user,
				languageCode
			})
		);
	}

	/**
	 * Find all invites of the current user.
	 *
	 * @returns Promise<IPagination<IInvite>> Invite object or NotFoundException
	 */
	@ApiOperation({ summary: 'Find all invites of current user' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invites'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No invites found for the current user'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	@Get('/me')
	async getCurrentUserInvites(): Promise<IPagination<IInvite>> {
		return await this.inviteService.getCurrentUserInvites();
	}

	/**
	 * Find all invites.
	 *
	 * @param options - The query parameters for pagination and filtering.
	 * @returns A promise that resolves to a paginated list of invites.
	 */
	@ApiOperation({ summary: 'Find all invites.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invites',
		type: [Invite] // Note: Swagger expects an array of invites
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	@UseValidationPipe()
	@Get('/')
	async findAll(@Query() options: PaginationParams<Invite>): Promise<IPagination<IInvite>> {
		return await this.inviteService.findAllInvites(options);
	}

	/**
	 * Delete record.
	 *
	 * @param id - The ID of the record to delete.
	 * @returns A promise that resolves to the delete result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.inviteService.delete(id);
	}

	/**
	 * Handle invitation response by accepting or rejecting it.
	 *
	 * @param id The ID of the invitation.
	 * @param action The action to perform (Accept or Reject).
	 * @param request The request object.
	 * @param languageCode The language code for internationalization.
	 * @returns Promise<any>
	 */
	@ApiOperation({ summary: 'Accept or Reject invite of current user' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Invite Accepted'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Put('/:id/:action')
	async handleInvitationResponse(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('action') action: InviteActionEnum,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<any> {
		return await this.inviteService.handleInvitationResponse(id, action, request.get('Origin'), languageCode);
	}
}
