import { ITenantSetting, RolesEnum } from '@gauzy/models';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../../core';
import { RequestContext } from '../../core/context';
import { Roles } from '../../shared/decorators/roles';
import { RoleGuard } from '../../shared/guards/auth/role.guard';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

@ApiTags('TenantSetting')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TenantSettingController extends CrudController<TenantSetting> {
	constructor(private tenantSettingService: TenantSettingService) {
		super(tenantSettingService);
	}

	@ApiOperation({
		summary: 'Get tenant settings',
		security: [
			{
				role: [RolesEnum.ADMIN]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Get()
	async get() {
		const user = RequestContext.currentUser();
		return this.tenantSettingService.findAll({
			where: {
				tenantId: user.tenantId
			}
		});
	}

	@ApiOperation({
		summary: 'Tenant settings updated successfully'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Tenant settings updated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Post()
	async saveSettings(
		@Body() entity: ITenantSetting
	): Promise<ITenantSetting> {
		return this.tenantSettingService.saveSettngs(entity);
	}
}
