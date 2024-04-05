import {
	ICreateEmailInvitesOutput,
	IInviteAcceptInput,
	PermissionsEnum,
	LanguagesEnum,
	IOrganizationContactAcceptInviteInput,
	IOrganizationContact,
	IPagination,
	IInvite,
	InviteActionEnum
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
	Req,
	ValidationPipe,
	UsePipes
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
@Controller()
export class InviteController {
	constructor(
		private readonly inviteService: InviteService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	@ApiOperation({ summary: 'Create email invites' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
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
	 * Validate invite by token and email
	 *
	 * @param options
	 * @returns
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
	@Get('validate')
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
	 * @param body
	 * @returns
	 */
	@Public()
	@Post('validate-by-code')
	@UseValidationPipe({ whitelist: true })
	async validateInviteByCode(@Body() body: ValidateInviteByCodeQueryDTO) {
		return await this.queryBus.execute(
			new FindInviteByEmailCodeQuery({
				email: body.email,
				code: body.code
			})
		);
	}

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
	@Post('accept')
	async acceptInvitation(
		@Body() entity: IInviteAcceptInput,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum
	) {
		return await this.commandBus.execute(new InviteAcceptCommand({ ...entity, originalUrl: origin }, languageCode));
	}

	/**
	 * Find All Invites
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all invites.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invites',
		type: Invite
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: PaginationParams<Invite>): Promise<IPagination<IInvite>> {
		return await this.inviteService.findAllInvites(options);
	}

	@ApiOperation({ summary: 'Accept organization contact invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('contact')
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
	 * Resend invite
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Resend invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('resend')
	@UseValidationPipe()
	async resendInvite(
		@Body() entity: ResendInviteDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<UpdateResult | Invite> {
		return await this.commandBus.execute(new InviteResendCommand(entity, languageCode));
	}

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
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: IInvite['id']): Promise<DeleteResult> {
		return await this.inviteService.delete(id);
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Put('organization-contact/:id')
	async inviteOrganizationContact(
		@Param('id', UUIDValidationPipe) id: string,
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

	@ApiOperation({ summary: 'Find all invites of current user' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found invites'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	@Get('me')
	async findInviteOfCurrentUser() {
		return await this.inviteService.findInviteOfCurrentUser();
	}

	@ApiOperation({ summary: 'Accept or Reject invite of current user' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Invite Accepted'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW, PermissionsEnum.ORG_INVITE_EDIT)
	@Put(':id/:action')
	async acceptMyInvitation(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('action') action: InviteActionEnum,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	) {
		return await this.inviteService.acceptMyInvitation(id, action, request.get('Origin'), languageCode);
	}
}
