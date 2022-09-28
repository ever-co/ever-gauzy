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
	UseGuards,
	UseInterceptors,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IPagination, IRole, IRoleMigrateInput, PermissionsEnum } from '@gauzy/contracts';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { RoleService } from './role.service';
import { Role } from './role.entity';
import { CreateRoleDTO, CreateRoleDTO as UpdateRoleDTO, FindRoleQueryDTO } from './dto';
import { TransformInterceptor } from './../core/interceptors';
import { CrudController } from './../core/crud';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';

@ApiTags('Role')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
@UseInterceptors(TransformInterceptor)
@Controller()
export class RoleController extends CrudController<Role> {

	constructor(
		private readonly roleService: RoleService
	) {
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
	@Get('options')
	async findOneRoleByOptions(
		@Query(new ValidationPipe({
			whitelist: true
		})) options: FindRoleQueryDTO
	): Promise<IRole> {
		try {
			return await this.roleService.findOneByWhereOptions(
				options as FindOptionsWhere<Role>
			);
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
		return this.roleService.findAll();
	}

	/**
	 * CREATE role for specific tenant
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: CreateRoleDTO
	): Promise<IRole> {
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
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: UpdateRoleDTO
	): Promise<UpdateResult | IRole> {
		try {
			await this.roleService.findOneByIdString(id);
			return await this.roleService.update(id, entity);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * DELETE role by id
	 *
	 * @param id
	 * @returns
	 */
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<DeleteResult> {
		try {
			return await this.roleService.delete(id);
		} catch (error) {
			throw new ForbiddenException();
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
}
