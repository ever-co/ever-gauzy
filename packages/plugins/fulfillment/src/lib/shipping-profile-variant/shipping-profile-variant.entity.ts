import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IShippingProfileVariant } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ShippingProfile } from '../shipping-profile/shipping-profile.entity';
import { MikroOrmShippingProfileVariantRepository } from './repository/mikro-orm-shipping-profile-variant.repository';

/**
 * The pivot that attaches a variant to a shipping profile.
 *
 * **A variant belongs to at most one profile.** That is the invariant this table exists to hold, and it
 * is enforced twice: by the unique index on `variantId` alone in the migration — not merely by the pair
 * index, which would happily allow a variant in two profiles — and by the service, which reassigns
 * rather than duplicating.
 *
 * The pivot is a declared entity rather than an ORM-managed join table, because it is a real row with
 * its own tenancy and audit columns and because a profile reassignment is an auditable event.
 */
@MultiORMEntity('shipping_profile_variant', {
	mikroOrmRepository: () => MikroOrmShippingProfileVariantRepository
})
export class ShippingProfileVariant extends TenantOrganizationBaseEntity implements IShippingProfileVariant {
	/** The profile. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	profileId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	variantId: ID;

	/** Open-ended payload, retained because a pivot row is the place a per-attachment exception lives. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The profile. */
	@MultiORMManyToOne(() => ShippingProfile, (it) => it.variants, { onDelete: 'CASCADE' })
	@JoinColumn()
	profile?: ShippingProfile;
}
