// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Query,
	UseGuards,
	HttpCode,
	Post,
	Body
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { UUIDValidationPipe } from '../shared';
import { User } from './user.entity';
import { UserService } from './user.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { RequestContext } from '../core/context';
import { CommandBus } from '@nestjs/cqrs';
import { UserCreateCommand } from './commands';
import { UserCreateInput as IUserCreateInput } from '@gauzy/models';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('User')
@Controller()
@UseGuards(AuthGuard('jwt'))
export class UserController extends CrudController<User> {
	constructor(
		private readonly userService: UserService,
		private readonly commandBus: CommandBus
	) {
		super(userService);
	}

	@ApiOperation({ summary: 'Find current user.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found current user',
		type: User
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/me')
	async findCurrentUser(@Query('data') data: string): Promise<User> {
		const { relations } = JSON.parse(data);
		const currentUserId = RequestContext.currentUser().id;
		return this.userService.findOne(currentUserId, {
			relations
		});
	}

	@ApiOperation({ summary: 'Find user by email address.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found user by email address',
		type: User
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/email/:email')
	async findByEmail(@Param('email') email: string): Promise<User> {
		return this.userService.getUserByEmail(email);
	}

	@ApiOperation({ summary: 'Find User by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: User
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<User> {
		return this.userService.findOne(id);
	}

	@ApiOperation({ summary: 'Find all users.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found users',
		type: User
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<User>> {
		const { relations, findInput } = JSON.parse(data);
		return this.userService.findAll({
			where: findInput,
			relations
		});
	}
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: IUserCreateInput,
		...options: any[]
	): Promise<User> {
		return this.commandBus.execute(new UserCreateCommand(entity));
	}
}
