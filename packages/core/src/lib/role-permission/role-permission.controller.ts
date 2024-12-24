import {
	Body,
	Controller,
	Delete,
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
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IPagination, IRolePermission, IRolePermissions, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateRolePermissionDTO, UpdateRolePermissionDTO } from './dto';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';

@ApiTags('Role')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
@Controller('/role-permissions')
export class RolePermissionController extends CrudController<RolePermission> {
	constructor(private readonly _rolePermissionService: RolePermissionService) {
		super(_rolePermissionService);
	}

	/**
	 * Import/Migrate role-permissions for specific tenant
	 *
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Import role-permissions from self hosted to gauzy cloud hosted in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Role Permissions have been successfully imported.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The request body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post('/import/migrate')
	async importRole(@Body() input: any) {
		return await this._rolePermissionService.migrateImportRecord(input);
	}

	/**
	 * Retrieves the permissions of the current user.
	 *
	 * @return {Promise<IPagination<RolePermission>>} A Promise that resolves to a paginated list of RolePermission objects.
	 */
	@ApiOperation({ summary: 'Find current user permissions.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found current user permissions',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Permissions not found'
	})
	@Permissions()
	@Get('/me')
	async findMePermissions(): Promise<IRolePermissions> {
		return await this._rolePermissionService.findMePermissions();
	}

	/**
	 * GET role permissions for a specific tenant with pagination.
	 *
	 * @param {PaginationParams<RolePermission>} query - The query parameters for pagination and filtering.
	 * @returns {Promise<IPagination<IRolePermission>>} - Returns a promise that resolves to a paginated list of role permissions.
	 */
	@ApiOperation({ summary: 'Retrieve role permissions for a specific tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role permissions.',
		type: RolePermission
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.OK)
	@Get(['/pagination', '/'])
	async findAllRolePermissions(
		@Query() query: PaginationParams<RolePermission>
	): Promise<IPagination<IRolePermission>> {
		return this._rolePermissionService.findAllRolePermissions(query);
	}

	/**
	 * CREATE role permissions for specific tenant
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateRolePermissionDTO): Promise<IRolePermission> {
		return this._rolePermissionService.createPermission(entity);
	}

	/**
	 * UPDATE role permissions for specific tenant
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateRolePermissionDTO
	): Promise<UpdateResult | IRolePermission> {
		return await this._rolePermissionService.updatePermission(id, entity);
	}

	/**
	 * DELETE role permissions for specific tenant
	 *
	 * @param id
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this._rolePermissionService.deletePermission(id);
	}
}
