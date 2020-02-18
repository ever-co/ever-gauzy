// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Query,
	UseGuards
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

@ApiTags('User')
@Controller()
export class UserController extends CrudController<User> {
	constructor(private readonly userService: UserService) {
		super(userService);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
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
}
