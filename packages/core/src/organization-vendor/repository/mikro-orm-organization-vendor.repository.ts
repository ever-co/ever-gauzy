import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationVendor } from '../organization-vendor.entity';

export class MikroOrmOrganizationVendorRepository extends EntityRepository<OrganizationVendor> { }
