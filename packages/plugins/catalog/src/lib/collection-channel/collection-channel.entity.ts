import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
import { Collection } from '../collection/collection.entity';
import { MikroOrmCollectionChannelRepository } from './repository/mikro-orm-collection-channel.repository';

/**
 * Publication of one collection on one sales channel.
 *
 * A collection's own lifecycle says whether it exists; this row says where it is shown. Keeping the
 * two apart is what lets a merchandiser prepare a shelf, publish it to one channel, and hold it back
 * from another without touching the collection itself.
 */
@MultiORMEntity('collection_channel', { mikroOrmRepository: () => MikroOrmCollectionChannelRepository })
export class CollectionChannel extends TenantOrganizationBaseEntity {
	/**
	 * The published collection.
	 */
	@ApiProperty({ type: () => Collection })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Collection, (it) => it.channels, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	collection: Collection;

	/**
	 * Id of the published collection.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CollectionChannel) => it.collection)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	collectionId: ID;

	/**
	 * Id of the channel the collection is published on.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	channelId: ID;

	/**
	 * Publication state for this channel, independent of the collection's own `status`.
	 */
	@ApiProperty({ type: () => String, enum: PublicationStatus, default: PublicationStatus.DRAFT })
	@IsEnum(PublicationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PublicationStatus, default: PublicationStatus.DRAFT })
	status: PublicationStatus;

	/**
	 * Instant of the first transition to `ACTIVE` on this channel.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	publishedAt?: Date;
}
