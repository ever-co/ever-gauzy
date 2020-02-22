import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';
import { CrudController } from '../core/crud/crud.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@Controller()
export class TenantController extends CrudController<Tenant> {
	constructor(private readonly tenantService: TenantService) {
		super(tenantService);
	}
}
