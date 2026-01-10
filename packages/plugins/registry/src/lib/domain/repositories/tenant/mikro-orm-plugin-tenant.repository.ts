import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginTenant } from '../../entities/plugin-tenant.entity';

export class MikroOrmPluginTenantRepository extends MikroOrmBaseEntityRepository<PluginTenant> {}
