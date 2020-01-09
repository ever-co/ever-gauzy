import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput
} from '@gauzy/models';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';

@ApiTags('Invite')
@Controller()
export class InviteController extends CrudController<Invite> {
	constructor(private readonly inviteService: InviteService) {
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
}
