import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, Product, TenantOrganizationBaseEntity } from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
import { MikroOrmProductChannelRepository } from './repository/mikro-orm-product-channel.repository';

/**
 * Publication of one product on one sales channel.
 *
 * Publication is per channel rather than a flag on the product, because the same product is a
 * different proposition in each place it is sold: a listing that is live in one channel and still
 * being prepared in another is the normal case, and a single boolean on the product cannot say so.
 * A product is served on a channel only when this row is `ACTIVE` **and** the product's own lifecycle
 * is `ACTIVE` **and** the product is enabled — the row is a permission, never an override.
 */
@MultiORMEntity('product_channel', { mikroOrmRepository: () => MikroOrmProductChannelRepository })
export class ProductChannel extends TenantOrganizationBaseEntity {
	/**
	 * The published product.
	 */
	@ApiProperty({ type: () => Product })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Product, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	product: Product;

	/**
	 * Id of the published product.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductChannel) => it.product)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	productId: ID;

	/**
	 * Id of the channel the product is published on.
	 *
	 * The channel is a platform concept whose row is delivered by the kernel scoping set, so the
	 * catalogue stores its identity and lets the migration own the referential constraint.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	channelId: ID;

	/**
	 * Publication state **for this channel only**.
	 */
	@ApiProperty({ type: () => String, enum: PublicationStatus, default: PublicationStatus.DRAFT })
	@IsEnum(PublicationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PublicationStatus, default: PublicationStatus.DRAFT })
	status: PublicationStatus;

	/**
	 * Instant of the first transition to `ACTIVE`. Never cleared once stamped, so the history of when a
	 * listing first went live survives a later withdrawal.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	publishedAt?: Date;

	/**
	 * When the listing was withdrawn. Non-null exactly while the row is not `ACTIVE`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	unpublishedAt?: Date;

	/**
	 * Channel-specific ordering inside a listing.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;

	/**
	 * Channel-specific featured flag, independent of the organization-wide flag on the product.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isFeatured: boolean;
}
