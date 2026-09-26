import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IShippingProfile } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ShippingOption } from '../shipping-option/shipping-option.entity';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';
import { MikroOrmShippingProfileRepository } from './repository/mikro-orm-shipping-profile.repository';

/**
 * A set of variants that ship the same way.
 *
 * The profile is what makes "this cart is only digital goods, do not offer a courier" expressible: a
 * variant belongs to at most one profile, and a variant with no profile uses the organization's default
 * one. The options a profile offers are the options whose `profileId` names it, plus the options that
 * name no profile at all — an option with no profile is offered for everything.
 */
@MultiORMEntity('shipping_profile', { mikroOrmRepository: () => MikroOrmShippingProfileRepository })
export class ShippingProfile extends TenantOrganizationBaseEntity implements IShippingProfile {
	/** The profile's name as an operator reads it. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	name: string;

	/** A stable code, unique per organization, for a configuration that is applied by name elsewhere. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Whether this is the profile a variant with no explicit attachment uses. At most one profile per
	 * organization may be the default; the service enforces it inside the writing transaction and the
	 * migration expresses it as a partial unique index where the dialect supports one.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/** A longer explanation for the operator who maintains the shipping configuration. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	/** Open-ended payload for a configuration this package does not model as a column. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The variants attached to this profile, one pivot row each. */
	@MultiORMOneToMany(() => ShippingProfileVariant, (it) => it.profile, { onDelete: 'CASCADE' })
	variants?: ShippingProfileVariant[];

	/** The options that name this profile. */
	@MultiORMOneToMany(() => ShippingOption, (it) => it.profile, { onDelete: 'SET NULL' })
	shippingOptions?: ShippingOption[];
}
