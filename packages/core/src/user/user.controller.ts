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
	ValidationPipe,
	ForbiddenException
} from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiTags,
	ApiBearerAuth
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import {
	IPagination,
	IUser,
	PermissionsEnum,
	IUserCreateInput,
	IUserUpdateInput
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { TransformInterceptor } from './../core/interceptors';
import { RequestContext } from '../core/context';
import { UUIDValidationPipe, ParseJsonPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { User, UserPreferredComponentLayoutDTO, UserPreferredLanguageDTO } from './user.entity';
import { UserService } from './user.service';
import { UserCreateCommand } from './commands';
import { DeleteAllDataService } from './delete-all-data/delete-all-data.service';

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

	/**
	 * GET current login user
	 * 
	 * @param data 
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
	async findMe(
		@Query('data', ParseJsonPipe) data: any
	): Promise<User> {
		const { relations = [] } = data;
		const id = RequestContext.currentUserId();
		return await this.userService.findOne(id, {
			relations
		});
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
	async findByEmail(@Param('email') email: string): Promise<User> {
		return this.userService.getUserByEmail(email);
	}

	/**
	 * UPDATE user preferred language
	 * 
	 * @param id 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard)
	@Put('/preferred-language/:id')
	@UsePipes(new ValidationPipe({
		transform: true,
		whitelist: true
	}))
	async updatePreferredLanguage(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UserPreferredLanguageDTO
	) {
		const userId = RequestContext.currentUserId();
		if (userId !== id) {
			throw new ForbiddenException();
		}

		const { preferredLanguage } = entity;
		return this.userService.updatePreferredLanguage(
			id,
			preferredLanguage
		);
	}

	/**
	 * UPDATE user preferred component layout
	 * 
	 * @param id 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard)
	@Put('/preferred-layout/:id')
	@UsePipes(new ValidationPipe({
		transform: true,
		whitelist: true
	}))
	async updatePreferredComponentLayout(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UserPreferredComponentLayoutDTO
	) {
		const userId = RequestContext.currentUserId();
		if (userId !== id) {
			throw new ForbiddenException();
		}
		
		const { preferredComponentLayout } = entity;
		return this.userService.updatePreferredComponentLayout(
			id, 
			preferredComponentLayout
		);
	}


	/**
	 * GET user count
	 * 
	 * @param data 
	 * @returns 
	 */
	@Get('count')
	async getCount(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { relations, findInput } = data;
		return this.userService.count({
			where: findInput,
			relations
		});
	}

	/**
	 * GET user list by pagination
	 * 
	 * @param filter 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IUser>
	): Promise<IPagination<IUser>> {
		return this.userService.paginate(filter);
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
	): Promise<IPagination<User>> {
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
	): Promise<User> {
		const { relations } = data;
		return this.userService.findOne(id, { relations });
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
	async create(
		@Body() entity: IUserCreateInput
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
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IUserUpdateInput
	): Promise<any> {
		return await this.userService.updateProfile(id, {
			id,
			...entity
		});
	}

	/**
	 * DELETE all user data from all tables
	 * 
	 * @param id 
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
	@Delete('/all-data/:id')
	async deleteAllData(
		@Param('id', UUIDValidationPipe) id: string
	){
		return this.deleteAllDataService.deleteAllData(id);
	}
}
