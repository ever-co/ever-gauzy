import { IQuery } from '@nestjs/cqrs';
import { PluginTenantQueryDTO } from '../../../shared/dto/plugin-tenant-query.dto';

export class GetAllPluginTenantsQuery implements IQuery {
	public static readonly type = '[Plugin Tenant] Get All';

	constructor(public readonly filter?: PluginTenantQueryDTO) {}
}
