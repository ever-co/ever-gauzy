import { AuthGuard } from '@nestjs/passport';
import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput,
	InviteAcceptInput,
	InviteResendInput,
	PermissionsEnum,
	LinkClientOrganizationInviteInput
} from '@gauzy/models';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
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
import { CommandBus } from '@nestjs/cqrs';
import {
	ApiOperation,
	ApiResponse,
	ApiTags,
	ApiExcludeEndpoint
} from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IPagination } from '../core';
import { InviteAcceptEmployeeCommand } from './commands/invite.accept-employee.command';
import { InviteAcceptUserCommand } from './commands/invite.accept-user.command';
import { InviteOrganizationClientsCommand } from './commands/invite.organization-clients.command';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { InviteResendCommand } from './commands/invite.resend.command';
import { Permissions } from './../shared/decorators/permissions';
import { PermissionGuard } from './../shared/guards/auth/permission.guard';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { InviteLinkOrganizationClientsCommand } from './commands/invite.link-organization-clients.command';
import { Request } from 'express';

@ApiTags('Invite')
@Controller()
export class InviteController {
	constructor(
		private readonly inviteService: InviteService,
		private readonly commandBus: CommandBus
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
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('/emails')
	async createManyWithEmailsId(
		@Body() entity: CreateEmailInvitesInput,
		@Req() request: Request
	): Promise<CreateEmailInvitesOutput> {
		return this.inviteService.createBulk(entity, request.get('Origin'));
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
	@Get('validate')
	async validateInvite(@Query('data') data: string): Promise<Invite> {
		const {
			relations,
			findInput: { email, token }
		} = JSON.parse(data);

		if (!email && !token) {
			throw new BadRequestException('Email & Token Mandatory');
		}

		return this.inviteService.validate(relations, email, token);
	}

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
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(
		PermissionsEnum.ORG_INVITE_VIEW,
		PermissionsEnum.ORG_INVITE_EDIT
	)
	@Get('all')
	async findAllInvites(
		@Query('data') data: string
	): Promise<IPagination<Invite>> {
		const { relations, findInput } = JSON.parse(data);

		return this.inviteService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Accept employee invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('employee')
	async acceptEmployeeInvite(
		@Body() entity: InviteAcceptInput
	): Promise<UpdateResult | Invite> {
		return this.commandBus.execute(new InviteAcceptEmployeeCommand(entity));
	}

	@ApiOperation({ summary: 'Accept user invite.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('user')
	async acceptUserInvite(
		@Body() entity: InviteAcceptInput
	): Promise<UpdateResult | Invite> {
		return this.commandBus.execute(new InviteAcceptUserCommand(entity));
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
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Post('resend')
	async resendInvite(
		@Body() entity: InviteResendInput
	): Promise<UpdateResult | Invite> {
		return this.commandBus.execute(new InviteResendCommand(entity));
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
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Delete(':id')
	async delete(@Param('id') id: string, ...options: any[]): Promise<any> {
		return this.inviteService.delete(id);
	}

	@ApiExcludeEndpoint()
	@Put()
	async update(@Param('id') id: string, ...options: any[]): Promise<any> {
		throw new BadRequestException('Invalid route');
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
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Put('organization-client/:id')
	async inviteClient(
		@Param('id') id: string,
		@Req() request
	): Promise<OrganizationClients> {
		return this.commandBus.execute(
			new InviteOrganizationClientsCommand({
				id,
				originalUrl: request.get('Origin'),
				inviterUser: request.user
			})
		);
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
	@Put('link-organization-client')
	async linkInviteClient(
		@Body() input: LinkClientOrganizationInviteInput
	): Promise<OrganizationClients> {
		return this.commandBus.execute(
			new InviteLinkOrganizationClientsCommand(input)
		);
	}
}
