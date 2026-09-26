import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { ShippingProfileVariant } from './shipping-profile-variant.entity';
import { TypeOrmShippingProfileVariantRepository } from './repository/type-orm-shipping-profile-variant.repository';
import { MikroOrmShippingProfileVariantRepository } from './repository/mikro-orm-shipping-profile-variant.repository';

/**
 * The variant-to-profile attachments.
 *
 * The pivot is a declared entity rather than an ORM-managed join table, so it has its own tenancy and
 * audit columns and a reassignment is an auditable event. The one-profile-per-variant rule is enforced
 * by the profile service, which moves an existing attachment rather than inserting a second one; the
 * migration expresses the same rule as a unique index on `variantId` alone on the dialects that support
 * a filtered one.
 */
@Injectable()
export class ShippingProfileVariantService extends TenantAwareCrudService<ShippingProfileVariant> {
	constructor(
		readonly typeOrmShippingProfileVariantRepository: TypeOrmShippingProfileVariantRepository,
		readonly mikroOrmShippingProfileVariantRepository: MikroOrmShippingProfileVariantRepository
	) {
		super(typeOrmShippingProfileVariantRepository, mikroOrmShippingProfileVariantRepository);
	}
}
