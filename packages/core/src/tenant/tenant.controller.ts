import { IPagination, ITenant, ITenantCreateInput, RolesEnum } from '@gauzy/contracts';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	MethodNotAllowedException,
	Param,
	Post,
	Put,
	UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UUIDValidationPipe } from './../shared/pipes';
import { RequestContext } from '../core/context';
import { CrudController } from '../core/crud/crud.controller';
import { Roles } from './../shared/decorators';
import { RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TenantController extends CrudController<Tenant> {
	constructor(private readonly tenantService: TenantService) {
		super(tenantService);
	}

	@Get('pagination')
	async pagination() {
		throw new MethodNotAllowedException();
	}

	@ApiOperation({
		summary: 'Find all tenants of the user' 
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tenants',
		type: Tenant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(RoleGuard, TenantPermissionGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Get()
	async findAll(): Promise<IPagination<ITenant>> {
		const tenantId = RequestContext.currentTenantId();
		return this.tenantService.findAll({
			where: {
				id: tenantId
			}
		});
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(RoleGuard, TenantPermissionGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ITenant> {
		const tenantId = RequestContext.currentTenantId();
		if (id !== tenantId) {
			throw new ForbiddenException();
		}
		return this.tenantService.findOne(tenantId);
	}

	@ApiOperation({
		summary:
			'Create new tenant. The user who creates the tenant is given the super admin role.'
	})
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
	@Post()
	async create(@Body() entity: ITenantCreateInput): Promise<ITenant> {
		const user = RequestContext.currentUser();
		if (user.tenantId || user.roleId) {
			throw new BadRequestException('Tenant already exists');
		}
		return await this.tenantService.onboardTenant(entity, user);
	}

	@ApiOperation({
		summary:
			'Update existin tenant. The user who updates the tenant is given the super admin role.'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.OK)
	@UseGuards(RoleGuard, TenantPermissionGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ITenantCreateInput
	): Promise<ITenant> {
		const tenantId = RequestContext.currentTenantId();
		if (id !== tenantId) {
			throw new ForbiddenException();
		}
		await this.tenantService.update(id, entity);
		return await this.findById(id);
	}

	@ApiOperation({
		summary: 'Delete tenant',
		security: [
			{
				role: [RolesEnum.SUPER_ADMIN]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The tenant has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard, TenantPermissionGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	) {
		const tenantId = RequestContext.currentTenantId();
		if (id !== tenantId) {
			throw new ForbiddenException();
		}
		return await this.tenantService.delete(id);
	}
}
