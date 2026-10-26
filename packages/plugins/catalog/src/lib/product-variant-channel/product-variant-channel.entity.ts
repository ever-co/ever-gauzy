import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
import { MikroOrmProductVariantChannelRepository } from './repository/mikro-orm-product-variant-channel.repository';

/**
 * Publication of a single variant on one sales channel.
 *
 * It lets a channel sell a subset of a product's variants — a size that is only sold online, a finish
 * exclusive to one marketplace. A variant with no publication rows of its own inherits its product's
 * publication, which is what keeps publication opt-in: a catalogue that never writes a row here sells
 * everything it publishes, exactly as before.
 */
@MultiORMEntity('product_variant_channel', {
	mikroOrmRepository: () => MikroOrmProductVariantChannelRepository
})
export class ProductVariantChannel extends TenantOrganizationBaseEntity {
	/**
	 * The published variant.
	 */
	@ApiProperty({ type: () => ProductVariant })
	@IsNotEmpty()
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant: ProductVariant;

	/**
	 * Id of the published variant.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ProductVariantChannel) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	variantId: ID;

	/**
	 * Id of the channel the variant is published on.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	channelId: ID;

	/**
	 * Publication state for this channel.
	 */
	@ApiProperty({ type: () => String, enum: PublicationStatus, default: PublicationStatus.DRAFT })
	@IsEnum(PublicationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PublicationStatus, default: PublicationStatus.DRAFT })
	status: PublicationStatus;

	/**
	 * Instant of the first transition to `ACTIVE`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	publishedAt?: Date;

	/**
	 * When the variant was withdrawn from this channel.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	unpublishedAt?: Date;

	/**
	 * Ordering of the variant inside the channel's listing of its product.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;
}
