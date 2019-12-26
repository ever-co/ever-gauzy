import {
	Controller,
	Get,
	HttpStatus,
	Param,
	HttpCode,
	Post,
	Body,
	Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { UUIDValidationPipe } from '../shared';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { DeepPartial, InsertResult } from 'typeorm';
import {
	CreateEmailInvitesInput,
	CreateInviteInput,
	CreateEmailInvitesOutput
} from '@gauzy/models';

@ApiTags('Invite')
@Controller()
export class InviteController extends CrudController<Invite> {
	constructor(private readonly inviteService: InviteService) {
		super(inviteService);
	}

	// @ApiOperation({ summary: 'Find Invite by id.' })
	// @ApiResponse({
	// 	status: HttpStatus.OK,
	//   description: 'Found one record',
	// 	type: Invite
	// })
	// @ApiResponse({
	// 	status: HttpStatus.NOT_FOUND,
	// 	description: 'Record not found'
	// })
	// @Get('code/:code')
	// async findByCode(@Param('code') code: string): Promise<Invite> {
	// 	return this.inviteService.getInviteByCode(code);
	// }

	// @ApiOperation({ summary: 'Find Invite by email.' })
	// @ApiResponse({
	// 	status: HttpStatus.OK,
	//   description: 'Found one record',
	// 	type: Invite
	// })
	// @ApiResponse({
	// 	status: HttpStatus.NOT_FOUND,
	// 	description: 'Record not found'
	// })
	// @Get('email/:email')
	// async findByEmail(@Param('code') code: string): Promise<Invite> {
	// 	return this.inviteService.getInviteByEmail(code);
	// }

	// @ApiOperation({ summary: 'Find Invites by email.' })
	// @ApiResponse({
	// 	status: HttpStatus.OK,
	//   description: 'Found one record',
	// 	type: Invite
	// })
	// @ApiResponse({
	// 	status: HttpStatus.NOT_FOUND,
	// 	description: 'Record not found'
	// })
	// @Get('emails')
	// async findManyByEmail(@Query('data') data: string): Promise<Invite[]> {
	//   const { emails } = JSON.parse(data);
	// 	return this.inviteService.getInvitesByEmail(emails);
	// }

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
}
