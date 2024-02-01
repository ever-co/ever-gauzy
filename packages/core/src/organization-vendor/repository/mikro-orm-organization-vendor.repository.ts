import { EntityRepository } from '@mikro-orm/core';
import { OrganizationVendor } from '../organization-vendor.entity';

export class MikroOrmOrganizationVendorRepository extends EntityRepository<OrganizationVendor> { }