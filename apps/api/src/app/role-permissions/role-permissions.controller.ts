import { PermissionsEnum } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Role')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class RolePermissionsController extends CrudController<RolePermissions> {
	constructor(
		private readonly rolePermissionsService: RolePermissionsService
	) {
		super(rolePermissionsService);
	}

	@ApiOperation({ summary: 'Find role permissions.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role permissions.',
		type: RolePermissions
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findRole(
		@Query('data') data: string
	): Promise<IPagination<RolePermissions>> {
		const { findInput } = JSON.parse(data);

		return this.rolePermissionsService.findAll({ where: findInput });
	}

	@ApiOperation({ summary: 'Create new record' })
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
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: RolePermissions,
		...options: any[]
	): Promise<RolePermissions> {
		return this.rolePermissionsService.create(entity);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: RolePermissions,
		...options: any[]
	): Promise<any> {
		return this.rolePermissionsService.update(id, entity);
	}
}
