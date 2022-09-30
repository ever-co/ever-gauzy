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
	UseInterceptors,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiTags,
	ApiBearerAuth
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import {
	IPagination,
	IUser,
	PermissionsEnum,
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { TransformInterceptor } from './../core/interceptors';
import { RequestContext } from '../core/context';
import { UUIDValidationPipe, ParseJsonPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserCreateCommand, UserDeleteCommand } from './commands';
import { FactoryResetService } from './factory-reset/factory-reset.service';
import {
	UpdatePreferredLanguageDTO,
	UpdatePreferredComponentLayoutDTO,
	CreateUserDTO,
	UpdateUserDTO,
	FindMeQueryDTO
} from './dto';

@ApiTags('User')
@ApiBearerAuth()
@UseInterceptors(TransformInterceptor)
@Controller()
export class UserController extends CrudController<User> {
	constructor(
		private readonly userService: UserService,
		private readonly factoryResetService: FactoryResetService,
		private readonly commandBus: CommandBus
	) {
		super(userService);
	}

	/**
	 * GET current login user
	 *
	 * @param options
	 * @returns
	 */
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findMe(@Query() options: FindMeQueryDTO): Promise<IUser> {
		return await this.userService.findMe(
			options.relations
		);
	}

	/**
	 * GET user by email
	 *
	 * @param email
	 * @returns
	 */
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
	async findByEmail(
		@Param('email') email: string
	): Promise<IUser | null> {
		return await this.userService.getUserByEmail(email);
	}

	/**
	 * UPDATE user preferred language
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard)
	@Put('/preferred-language')
	async updatePreferredLanguage(
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: UpdatePreferredLanguageDTO
	): Promise<IUser> {
		return await this.userService.updatePreferredLanguage(
			RequestContext.currentUserId(),
			entity.preferredLanguage
		);
	}


	/**
	 * UPDATE user preferred component layout
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard)
	@Put('/preferred-layout')
	async updatePreferredComponentLayout(
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: UpdatePreferredComponentLayoutDTO
	): Promise<IUser> {
		return await this.userService.updatePreferredComponentLayout(
			RequestContext.currentUserId(),
			entity.preferredComponentLayout
		);
	}

	/**
	 * GET user count
	 *
	 * @param data
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	@Get('count')
	async getCount(
		@Query('data', ParseJsonPipe) data: any
	): Promise<number> {
		const { relations, findInput } = data;
		return this.userService.count({
			where: findInput,
			relations
		});
	}

	/**
	 * GET user list by pagination
	 *
	 * @param options
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	@Get('pagination')
	async pagination(
		@Query() options: PaginationParams<User>
	): Promise<IPagination<IUser>> {
		return this.userService.paginate(options);
	}

	/**
	 * GET all users
	 *
	 * @param data
	 * @returns
	 */
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
	): Promise<IPagination<IUser>> {
		const { relations, findInput } = data;
		return this.userService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET user by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
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
	): Promise<IUser> {
		const { relations } = data;
		return this.userService.findOneByIdString(id, { relations });
	}

	/**
	 * CREATE new user
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
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
	@UsePipes(new ValidationPipe({ transform : true }))
	async create(
		@Body() entity: CreateUserDTO
	): Promise<IUser> {
		return await this.commandBus.execute(
			new UserCreateCommand(entity)
		);
	}

	/**
	 * UPDATE user by id
	 *
	 * @param id
	 * @param entity
	 * @param options
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Put(':id')
	@UsePipes(new ValidationPipe({ transform : true }))
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateUserDTO
	): Promise<IUser> {
		return await this.userService.updateProfile(id, {
			id,
			...entity
		});
	}

	/**
	 * DELTE user account
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({
		summary: 'Delete record'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ACCESS_DELETE_ACCOUNT)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string,
	): Promise<DeleteResult> {
		return await this.commandBus.execute(
			new UserDeleteCommand(id)
		);
	}

	/**
	 * DELETE all user data from all tables
	 *
	 * @returns
	 */
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ACCESS_DELETE_ALL_DATA)
	@Delete('/reset')
	async factoryReset() {
		return await this.factoryResetService.reset();
	}
}