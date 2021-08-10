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
	Body,
	Put,
	Delete,
	UseInterceptors
} from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiTags,
	ApiBearerAuth
} from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { UUIDValidationPipe, ParseJsonPipe } from './../shared/pipes';
import { User } from './user.entity';
import { UserService } from './user.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { RequestContext } from '../core/context';
import { CommandBus } from '@nestjs/cqrs';
import { UserCreateCommand } from './commands';
import { IUserCreateInput, IUserUpdateInput } from '@gauzy/contracts';
import { DeleteAllDataService } from './delete-all-data/delete-all-data.service';
import { TransformInterceptor } from './../core/interceptors';

@ApiTags('User')
@ApiBearerAuth()
@UseInterceptors(TransformInterceptor)
@Controller()
export class UserController extends CrudController<User> {
	constructor(
		private readonly userService: UserService,
		private readonly deleteAllDataService: DeleteAllDataService,
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
	async findCurrentUser(
		@Query('data', ParseJsonPipe) data: any
	): Promise<User> {
		const { relations = [] } = data;
		const id = RequestContext.currentUserId();
		return await this.userService.findOne(id, {
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
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<User> {
		const { relations } = data;
		return this.userService.findOne(id, { relations });
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<User>> {
		const { relations, findInput } = data;
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: IUserCreateInput,
		...options: any[]
	): Promise<User> {
		return this.commandBus.execute(new UserCreateCommand(entity));
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IUserUpdateInput,
		...options: any[]
	): Promise<any> {
		return this.userService.updateProfile(id, {
			id,
			...entity
		});
	}

	@ApiOperation({ summary: 'Delete all user data.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Deleted all user data.',
		type: User
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete('/all-data/:id')
	async deleteAllData(
		@Param('id', UUIDValidationPipe) id: string
	){
		return this.deleteAllDataService.deleteAllData(id);
	}
}
