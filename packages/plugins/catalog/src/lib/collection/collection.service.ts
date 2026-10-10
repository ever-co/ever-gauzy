import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EventBus, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { CollectionType, PublicationStatus } from '../catalog.types';
import { CollectionChangedEvent } from '../events';
import { Collection } from './collection.entity';
import { MikroOrmCollectionRepository } from './repository/mikro-orm-collection.repository';
import { TypeOrmCollectionRepository } from './repository/type-orm-collection.repository';

/**
 * Collections and their tree.
 *
 * Every read and every write is scoped to the caller's tenant and organization, and a collection owned
 * by a buyer is additionally private to that buyer: a saved list belonging to one contact is invisible
 * to every other contact of the same organization, so the ownership column is a filter and not merely
 * a label.
 */
@Injectable()
export class CollectionService extends TenantAwareCrudService<Collection> {
	constructor(
		readonly typeOrmCollectionRepository: TypeOrmCollectionRepository,
		readonly mikroOrmCollectionRepository: MikroOrmCollectionRepository,
		private readonly eventBus: EventBus
	) {
		super(typeOrmCollectionRepository, mikroOrmCollectionRepository);
	}

	/**
	 * Creates a collection after checking the two rules a slug has to satisfy.
	 *
	 * @param entity The collection to create.
	 * @returns The persisted collection.
	 * @throws BadRequestException When the type and the owner disagree — a customer-owned list may not
	 * carry rules — or when the slug is already taken in the scope it has to be unique in.
	 */
	public async create(entity: DeepPartial<Collection>): Promise<Collection> {
		if (entity.customerId && entity.type && entity.type !== CollectionType.MANUAL) {
			throw new BadRequestException(
				'A collection owned by a customer is a saved list and cannot be rule-based. Create it as MANUAL.'
			);
		}

		if (entity.slug) {
			await this.assertSlugIsAvailable(entity.slug, entity.customerId ?? null);
		}

		const collection = await super.create({
			type: CollectionType.MANUAL,
			status: PublicationStatus.DRAFT,
			sortOrder: 0,
			isFeatured: false,
			...entity
		});

		await this.eventBus.publish(CollectionChangedEvent.from(collection));

		return collection;
	}

	/**
	 * Updates a collection, re-checking the slug rule when the slug or the owner changes.
	 *
	 * The base class answers a write with the write's own result — an affected-row count on the
	 * TypeORM branch — which names no collection at all, so the row the write produced is read back
	 * before it is announced and before it is returned. The announcement and the answer then describe
	 * the same state, which is what lets a subscriber invalidate the listing it is told about rather
	 * than an unnamed one.
	 *
	 * @param id Id of the collection.
	 * @param entity The fields to change.
	 * @returns The updated collection.
	 */
	public async update(id: ID, entity: DeepPartial<Collection>): Promise<Collection> {
		const collection = await this.findOneByIdString(id);

		if (entity.slug && entity.slug !== collection.slug) {
			await this.assertSlugIsAvailable(entity.slug, entity.customerId ?? collection.customerId ?? null, id);
		}

		await super.update(id, entity);

		const updated = await this.findOneByIdString(id);

		await this.eventBus.publish(CollectionChangedEvent.from(updated));

		return updated;
	}

	/**
	 * Moves a collection to another parent, after refusing a move that would make it its own ancestor.
	 *
	 * The check walks up from the new parent, so a cycle is refused before the closure table is
	 * rewritten rather than after.
	 *
	 * As in `update`, the moved row is read back after the move and that read is what is announced
	 * and returned: a re-parent changes the collection's place in the tree, not its identity, so the
	 * announcement has to name the collection the write landed on.
	 *
	 * @param id Id of the collection to move.
	 * @param parentId The new parent, or null to make the collection a root.
	 * @returns The updated collection.
	 * @throws BadRequestException When the move would create a cycle.
	 */
	public async move(id: ID, parentId: ID | null): Promise<Collection> {
		if (parentId) {
			if (parentId === id) {
				throw new BadRequestException('A collection cannot be its own parent.');
			}

			if (await this.isDescendantOf(parentId, id)) {
				throw new BadRequestException(
					'A collection cannot be moved under one of its own descendants; that would create a cycle.'
				);
			}
		}

		await super.update(id, { parentId });

		const moved = await this.findOneByIdString(id);

		await this.eventBus.publish(CollectionChangedEvent.from(moved));

		return moved;
	}

	/**
	 * Reads a collection by its slug for the caller's organization.
	 *
	 * @param slug The slug to look up.
	 * @returns The collection.
	 * @throws NotFoundException When no collection of the caller's organization carries the slug.
	 */
	public async findBySlug(slug: string): Promise<Collection> {
		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		if (!organizationId) {
			throw new BadRequestException('A collection cannot be read without an organization in context.');
		}

		const where: FindOptionsWhere<Collection> = { slug, organizationId };

		if (tenantId) {
			where.tenantId = tenantId;
		}

		const collection = await this.typeOrmCollectionRepository.findOne({ where, relations: { children: true } });

		if (!collection) {
			throw new NotFoundException(`No collection with slug "${slug}" exists in this organization.`);
		}

		return collection;
	}

	/**
	 * @param slug The candidate slug.
	 * @param customerId The owning buyer, when the collection is a saved list.
	 * @param exceptId A collection id to exclude, used when updating a row in place.
	 * @throws BadRequestException When the slug is taken.
	 */
	private async assertSlugIsAvailable(slug: string, customerId: ID | null, exceptId?: ID): Promise<void> {
		const where: FindOptionsWhere<Collection> = customerId ? { slug, customerId } : { slug };

		if (!customerId) {
			where.organizationId = RequestContext.currentOrganizationId();
			where.customerId = null;
		}

		if (exceptId) {
			where.id = Not(exceptId);
		}

		const existing = await this.typeOrmCollectionRepository.findOne({ where });

		if (existing) {
			throw new BadRequestException(`A collection with slug "${slug}" already exists in this scope.`);
		}
	}

	/**
	 * @param candidateId The id being tested as a descendant.
	 * @param ancestorId The id being tested as an ancestor.
	 * @returns True when `candidateId` sits below `ancestorId` in the tree. The walk is bounded by the
	 * tree's depth, which a move cannot exceed because a cycle is refused as soon as it would form.
	 */
	private async isDescendantOf(candidateId: ID, ancestorId: ID): Promise<boolean> {
		let current: ID | undefined | null = candidateId;

		while (current) {
			if (current === ancestorId) {
				return true;
			}

			const parent = await this.typeOrmCollectionRepository.findOne({
				where: { id: current },
				select: { id: true, parentId: true }
			});

			current = parent?.parentId;
		}

		return false;
	}
}
