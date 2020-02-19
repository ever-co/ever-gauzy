import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput,
	InviteAcceptInput,
	InviteResendInput,
	PermissionsEnum
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
	Param
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { InviteAcceptEmployeeCommand } from './commands/invite.accept-employee.command';
import { InviteAcceptUserCommand } from './commands/invite.accept-user.command';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { InviteResendCommand } from './commands/invite.resend.command';
import { Permissions } from './../shared/decorators/permissions';
import { PermissionGuard } from './../shared/guards/auth/permission.guard';

@ApiTags('Invite')
@Controller()
export class InviteController extends CrudController<Invite> {
	constructor(
		private readonly inviteService: InviteService,
		private readonly commandBus: CommandBus
	) {
		super(inviteService);
	}

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
	@Post('/emails')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	async createManyWithEmailsId(
		@Body() entity: CreateEmailInvitesInput
	): Promise<CreateEmailInvitesOutput> {
		return this.inviteService.createBulk(entity);
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
	@UseGuards(PermissionGuard)
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	@Delete(':id')
	async delete(@Param('id') id: string, ...options: any[]): Promise<any> {
		return this.inviteService.delete(id);
	}
}
