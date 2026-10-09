import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DEFAULT_STANDARD_WORK_HOURS_PER_DAY } from '@gauzy/constants';
import { ITenant, IOrganization, IRolePermission, IFeatureOrganization, ID, IImageAsset } from '@gauzy/contracts';
import { BaseEntity, FeatureOrganization, ImageAsset, Organization, RolePermission } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';

@MultiORMEntity('tenant', { mikroOrmRepository: () => MikroOrmTenantRepository })
export class Tenant extends BaseEntity implements ITenant {
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	logo?: string;

	/**
	 * Stripe customer this tenant bills through, on hosted deployments.
	 *
	 * Indexed because the billing endpoints and the Stripe webhook both look a tenant up by it.
	 * Null on every self-hosted install — nothing in the platform requires it to be set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	// Named to match the migration. Left unnamed, TypeORM derives a hashed name of its own, which
	// will not match the one the migration creates — and the schema comparison then wants to add a
	// second index over the same column.
	// Unique: two tenants sharing one Stripe customer would each be able to read and cancel the
	// other's subscription. The name is stated so it matches the migration — left to TypeORM, the
	// derived hash would not, and schema comparison would ask for a second index.
	@ColumnIndex('IDX_tenant_stripe_customer_id', { unique: true })
	@MultiORMColumn({ nullable: true })
	stripeCustomerId?: string;

	/**
	 * Standard work hours per day for the tenant.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Standard work hours per day for the tenant',
		minimum: 1,
		maximum: 24
	})
	@IsOptional()
	@IsNumber()
	@Max(24, { message: 'Standard work hours per day cannot exceed 24 hours' })
	@Min(1, { message: 'Standard work hours per day must be at least 1 hour' })
	@MultiORMColumn({ nullable: true, default: DEFAULT_STANDARD_WORK_HOURS_PER_DAY })
	standardWorkHoursPerDay?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Tenant) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => Organization, (it) => it.tenant, {
		cascade: true
	})
	@JoinColumn()
	organizations?: IOrganization[];

	@MultiORMOneToMany(() => RolePermission, (it) => it.tenant, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];

	/**
	 * Array of feature organizations associated with the entity.
	 */
	@MultiORMOneToMany(() => FeatureOrganization, (it) => it.tenant, {
		cascade: true
	})
	featureOrganizations?: IFeatureOrganization[];
}
