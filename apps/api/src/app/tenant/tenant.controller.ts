import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud/crud.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Tenant')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TenantController extends CrudController<Tenant> {
	constructor(private readonly tenantService: TenantService) {
		super(tenantService);
	}
}
