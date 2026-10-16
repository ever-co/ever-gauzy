import { Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, assertPlainReferencesNotForeign } from '@gauzy/core';
import { SHIPPING_PROFILE_VARIANT_REFERENCES } from '../fulfillment.references';
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
 *
 * That index spans tenants, so the variant an attachment names is held to the caller's tenant on every
 * write (`fulfillment.references.ts`): an attachment of another tenant's variant would keep that tenant
 * from attaching its own.
 */
@Injectable()
export class ShippingProfileVariantService extends TenantAwareCrudService<ShippingProfileVariant> {
	constructor(
		readonly typeOrmShippingProfileVariantRepository: TypeOrmShippingProfileVariantRepository,
		readonly mikroOrmShippingProfileVariantRepository: MikroOrmShippingProfileVariantRepository
	) {
		super(typeOrmShippingProfileVariantRepository, mikroOrmShippingProfileVariantRepository);
	}

	/**
	 * Refuses attachments, or a change to one, naming a variant of another tenant.
	 *
	 * `create` and `update` run it; the profile's `assignVariants` runs it for every variant it adds before it
	 * moves any attachment, so a refused assignment leaves the attachments as they were.
	 *
	 * @param payloads The attachment or attachments, or the change set, about to be written.
	 * @throws ForbiddenException when a variant belongs to another tenant.
	 */
	public async assertReferences(payloads: unknown): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmShippingProfileVariantRepository.manager,
			payloads,
			SHIPPING_PROFILE_VARIANT_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Attaches a variant to a profile, refusing a variant of another tenant.
	 *
	 * @param entity The attachment to create.
	 * @returns The created attachment.
	 */
	public async create(entity: DeepPartial<ShippingProfileVariant>): Promise<ShippingProfileVariant> {
		await this.assertReferences(entity);

		return super.create(entity);
	}

	/**
	 * Changes an attachment, refusing a change that points it at a variant of another tenant.
	 *
	 * @param id The attachment, or the conditions that select the attachments to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<ShippingProfileVariant>,
		partialEntity: QueryDeepPartialEntity<ShippingProfileVariant>
	): Promise<ShippingProfileVariant | UpdateResult> {
		await this.assertReferences(partialEntity);

		return super.update(id, partialEntity);
	}
}
