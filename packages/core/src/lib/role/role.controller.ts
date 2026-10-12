import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IPagination, IRole, IRoleMigrateInput, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { RoleService } from './role.service';
import { Role } from './role.entity';
import { CreateRoleDTO, CreateRoleDTO as UpdateRoleDTO, FindRoleQueryDTO } from './dto';
import { CrudController } from './../core/crud';
import { RequestContext } from './../core/context';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions, Roles } from './../shared/decorators';

@ApiTags('Role')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
@Controller('/roles')
export class RoleController extends CrudController<Role> {
	constructor(private readonly roleService: RoleService) {
		super(roleService);
	}

	/**
	 * GET role by where condition
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find role.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role',
		type: Role
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS, PermissionsEnum.ORG_TEAM_ADD)
	@Get('options')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findOneRoleByOptions(@Query() options: FindRoleQueryDTO): Promise<IRole> {
		try {
			try {
				return await this.roleService.findOneByIdString(RequestContext.currentRoleId(), {
					where: {
						name: RolesEnum.EMPLOYEE
					}
				});
			} catch (e) {
				return await this.roleService.findOneByWhereOptions(options as FindOptionsWhere<Role>);
			}
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * GET roles for specific tenant
	 *
	 * @returns
	 */
	@ApiOperation({ summary: 'Find roles.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found roles.',
		type: Role
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(): Promise<IPagination<IRole>> {
		return await this.roleService.findAll();
	}

	/**
	 * CREATE role for specific tenant
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateRoleDTO): Promise<IRole> {
		try {
			return await this.roleService.create(entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * UPDATE role by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IRole['id'],
		@Body() entity: UpdateRoleDTO
	): Promise<UpdateResult | IRole> {
		try {
			await this.roleService.findOneByIdString(id);
			return await this.roleService.update(id, entity);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * Deletes a role by its ID.
	 * This endpoint handles HTTP DELETE requests to delete a role identified by the given ID.
	 *
	 * @param id - The UUID of the role to delete.
	 * @returns {Promise<DeleteResult>} - The result of the delete operation.
	 */
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: IRole['id']): Promise<DeleteResult> {
		try {
			return await this.roleService.delete(id);
		} catch (error) {
			console.error('Error while deleting role:', error);
			throw new ForbiddenException(`Deletion of role with ID ${id} is forbidden`);
		}
	}

	/**
	 * Import self hosted to gauzy cloud
	 *
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Import role from self hosted to gauzy cloud hosted in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Role have been successfully imported.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The request body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post('import/migrate')
	async importRole(@Body() input: IRoleMigrateInput[]) {
		return await this.roleService.migrateImportRecord(input);
	}

	/**
	 * Creates, in the caller's own tenant, every default role the tenant does not hold.
	 *
	 * The bulk write tenant onboarding performs, restricted to the credential's tenant: the body names no
	 * tenant, so no caller can write roles into another one. Idempotent — a complete tenant gets an empty
	 * answer — and a withdrawn default role is left for recovery rather than duplicated. `SUPER_ADMIN` only,
	 * by role, on top of the class's own guards and `CHANGE_ROLES_PERMISSIONS`.
	 *
	 * @returns The roles created.
	 */
	@ApiOperation({ summary: "Create the default roles the caller's tenant is missing (SUPER_ADMIN)." })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The roles created; empty when none were missing.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller is not a SUPER_ADMIN.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@Post('bulk')
	async createMissingDefaultRoles(): Promise<IRole[]> {
		return await this.roleService.createMissingDefaultRoles();
	}
}
