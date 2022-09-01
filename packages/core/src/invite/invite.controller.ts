import {
	ICreateEmailInvitesOutput,
	IInviteAcceptInput,
	IInviteResendInput,
	PermissionsEnum,
	LanguagesEnum,
	IOrganizationContactAcceptInviteInput,
	IOrganizationContact,
	IPagination,
	IInvite
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
	UseInterceptors,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { Public } from '@gauzy/common';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
import { TransformInterceptor } from './../core/interceptors';
import { PaginationParams } from './../core/crud';
import {
	InviteAcceptCommand,
	InviteAcceptOrganizationContactCommand,
	InviteBulkCreateCommand,
	InviteOrganizationContactCommand,
	InviteResendCommand
} from './commands';
import { CreateInviteDTO, FindInviteQueryDTO } from './dto';
import { FindPublicInviteByEmailTokenQuery } from './queries';

@ApiTags('Invite')
@UseInterceptors(TransformInterceptor)
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('/emails')
	async createManyWithEmailsId(
		@Body(new ValidationPipe({ transform: true })) entity: CreateInviteDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<ICreateEmailInvitesOutput> {
		return await this.commandBus.execute(
			new InviteBulkCreateCommand(
				entity,
				languageCode
			)
		);
	}

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
	async validateInvite(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: FindInviteQueryDTO
	) {
		return await this.queryBus.execute(
			new FindPublicInviteByEmailTokenQuery({
				email: options.email,
				token: options.token
			}, options.relations)
		);
	}

	@ApiOperation({ summary: 'Accept employee/user/candidate invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully exceuted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Public()
	@Post('accept')
	async acceptInvitation(
		@Body() entity: IInviteAcceptInput,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum
	) {
		return await this.commandBus.execute(
			new InviteAcceptCommand({
				...entity,
				originalUrl: origin
			}, languageCode)
		);
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
	async findAll(
		@Query(new ValidationPipe({ transform: true })) options: PaginationParams<Invite>
	): Promise<IPagination<IInvite>> {
		return await this.inviteService.findAllInvites(options);
	}

	@ApiOperation({ summary: 'Accept organization contact invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('contact')
	@Public()
	async acceptOrganizationContactInvite(
		@Body() input: IOrganizationContactAcceptInviteInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<any> {
		input.originalUrl = request.get('Origin');
		return this.commandBus.execute(
			new InviteAcceptOrganizationContactCommand(input, languageCode)
		);
	}

	@ApiOperation({ summary: 'Resend invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('resend')
	async resendInvite(
		@Body() entity: IInviteResendInput,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<UpdateResult | Invite> {
		return this.commandBus.execute(new InviteResendCommand(entity, languageCode));
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
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<DeleteResult> {
		return this.inviteService.delete(id);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Put('organization-contact/:id')
	async inviteOrganizationContact(
		@Param('id', UUIDValidationPipe) id: string,
		@Req() request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IOrganizationContact> {
		return this.commandBus.execute(
			new InviteOrganizationContactCommand({
				id,
				originalUrl: request.get('Origin'),
				inviterUser: request.user,
				languageCode
			})
		);
	}
}
