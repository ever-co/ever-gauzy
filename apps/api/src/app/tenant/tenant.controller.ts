import { ITenant, ITenantCreateInput, RolesEnum } from '@gauzy/models';
import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UseGuards,
	BadRequestException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestContext } from '../core/context';
import { CrudController } from '../core/crud/crud.controller';
import { RoleService } from '../role/role.service';
import { Roles } from '../shared/decorators/roles';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { UserService } from '../user/user.service';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TenantController extends CrudController<Tenant> {
	constructor(
		private readonly tenantService: TenantService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {
		super(tenantService);
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
		const tenant = await this.tenantService.create(entity);
		const role = await this.roleService.findOne({
			name: RolesEnum.SUPER_ADMIN
		});
		this.userService.update(user.id, {
			tenant: {
				id: tenant.id
			},
			role: {
				id: role.id
			}
		});
		return tenant;
	}

	@ApiOperation({
		summary: 'Delete tenant',
		security: [
			{
				role: [RolesEnum.ADMIN]
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
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete(':id')
	async delete(@Param('id') id: string) {
		return this.tenantService.delete(id);
	}
}
