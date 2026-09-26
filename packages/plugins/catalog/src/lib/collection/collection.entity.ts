import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ImageAsset,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	OrganizationContact,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { CollectionType, PublicationStatus } from '../catalog.types';
import { CollectionChannel } from '../collection-channel/collection-channel.entity';
import { CollectionProduct } from '../collection-product/collection-product.entity';
import { CollectionVariant } from '../collection-variant/collection-variant.entity';
import { MikroOrmCollectionRepository } from './repository/mikro-orm-collection.repository';

/**
 * A curated merchandising group.
 *
 * A collection is deliberately not a tag. A tag is a flat label whose meaning is the same everywhere;
 * a collection carries membership with an explicit position, an optional publication window, its own
 * publication rows per channel and, when it is rule-based, a rule set. Those four things together are
 * what a merchandiser means by a "shelf", and none of them can be expressed by attaching a label.
 *
 * When `customerId` is set the collection belongs to a buyer rather than to the merchandising team.
 * That is how a saved list is modelled without a second grouping table: the list is a collection whose
 * owner is a contact, it is invisible to every other contact, and it may not carry rules.
 *
 * `parentId` makes the collection a tree, whose closure table the ORM maintains — see the migration,
 * which creates `collection_closure` and never declares it as an entity.
 */
@Tree('closure-table')
@MultiORMEntity('collection', { mikroOrmRepository: () => MikroOrmCollectionRepository })
export class Collection extends TenantOrganizationBaseEntity {
	/**
	 * Display name of the collection.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * URL-safe identity of the collection, unique inside its organization (or inside its owning
	 * customer, when it has one).
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 255 })
	slug: string;

	/**
	 * Free text shown above the collection's items.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * How the collection decides what it contains.
	 */
	@ApiProperty({ type: () => String, enum: CollectionType, default: CollectionType.MANUAL })
	@IsEnum(CollectionType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: CollectionType, default: CollectionType.MANUAL })
	type: CollectionType;

	/**
	 * Hero image of the collection.
	 */
	@ApiPropertyOptional({ type: () => ImageAsset })
	@IsOptional()
	@MultiORMManyToOne(() => ImageAsset, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	image?: ImageAsset;

	/**
	 * Id of the hero image.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Collection) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	imageId?: ID;

	/**
	 * Parent collection, which turns the flat list into a tree of departments and shelves.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Collection) => it.parent)
	@ColumnIndex()
	// A persisted column on both ORMs, not a relation id: the parent is TypeORM's tree relation only, and
	// `relationId: true` would map this `persist: false` on MikroORM with no relation behind it, so the
	// parent was dropped on every MikroORM write and read back empty.
	@MultiORMColumn({ type: 'uuid', nullable: true })
	parentId?: ID;

	/**
	 * Parent collection. The closure table the ORM maintains is what makes "every descendant of this
	 * collection" a single indexed join rather than a recursive query.
	 */
	@ApiPropertyOptional({ type: () => Collection })
	@IsOptional()
	@TreeParent()
	@JoinColumn()
	parent?: Collection;

	/**
	 * Child collections.
	 */
	@ApiPropertyOptional({ type: () => [Collection] })
	@IsOptional()
	@TreeChildren({ cascade: true })
	children?: Collection[];

	/**
	 * Ordering of the collection among its siblings.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;

	/**
	 * Lifecycle of the collection itself, independent of where it is published.
	 */
	@ApiProperty({ type: () => String, enum: PublicationStatus, default: PublicationStatus.DRAFT })
	@IsEnum(PublicationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PublicationStatus, default: PublicationStatus.DRAFT })
	status: PublicationStatus;

	/**
	 * Start of the window the collection is live in; null means open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the window the collection is live in; null means open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Merchandising flag for "featured collections" navigation.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isFeatured: boolean;

	/**
	 * The buyer who owns the collection. Null for a merchandising collection; set for a saved list.
	 *
	 * The reference cascades: a list has no meaning once the contact it belongs to is gone, and a
	 * buyer's own list is not a merchandising artefact somebody has to clean up.
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	customer?: OrganizationContact;

	/**
	 * Id of the owning buyer, when the collection is a saved list rather than a merchandising shelf.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Collection) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	customerId?: ID;

	/**
	 * Tenant extras: a layout hint, a badge, an external taxonomy id.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Manual product membership, with its position.
	 */
	@ApiPropertyOptional({ type: () => [CollectionProduct] })
	@IsOptional()
	@MultiORMOneToMany(() => CollectionProduct, (it) => it.collection)
	products?: CollectionProduct[];

	/**
	 * Manual variant membership, with its position.
	 */
	@ApiPropertyOptional({ type: () => [CollectionVariant] })
	@IsOptional()
	@MultiORMOneToMany(() => CollectionVariant, (it) => it.collection)
	variants?: CollectionVariant[];

	/**
	 * Where the collection is published.
	 */
	@ApiPropertyOptional({ type: () => [CollectionChannel] })
	@IsOptional()
	@MultiORMOneToMany(() => CollectionChannel, (it) => it.collection)
	channels?: CollectionChannel[];

	/**
	 * @returns True when the collection is owned by a buyer rather than by the merchandising team.
	 */
	isCustomerOwned(): boolean {
		return !!this.customerId;
	}

	/**
	 * @param moment The moment to test, defaulting to now.
	 * @returns True when the collection's window contains the moment. An open bound is always open.
	 */
	isWithinWindow(moment: Date = new Date()): boolean {
		if (this.startsAt && new Date(this.startsAt).getTime() > moment.getTime()) {
			return false;
		}

		return !this.endsAt || new Date(this.endsAt).getTime() >= moment.getTime();
	}
}
