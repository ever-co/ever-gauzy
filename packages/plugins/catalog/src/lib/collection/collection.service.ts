import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, IsNull, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EventBus, RequestContext } from '@gauzy/core';
import { CollectionType, PublicationStatus } from '../catalog.types';
import { CollectionChangedEvent } from '../events';
import { Collection } from './collection.entity';
import { MikroOrmCollectionRepository } from './repository/mikro-orm-collection.repository';
import { TypeOrmCollectionRepository } from './repository/type-orm-collection.repository';
import { CatalogCrudService } from '../catalog-crud.service';

/**
 * Collections and their tree.
 *
 * Every read and every write is scoped to the caller's tenant and organization, and a collection owned
 * by a buyer is additionally private to that buyer: a saved list belonging to one contact is invisible
 * to every other contact of the same organization, so the ownership column is a filter and not merely
 * a label.
 */
@Injectable()
export class CollectionService extends CatalogCrudService<Collection> {
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
	 * A collection created without an organization is stamped with the caller's (see the note below).
	 *
	 * @param entity The collection to create.
	 * @returns The persisted collection.
	 * @throws BadRequestException When the type and the owner disagree — a customer-owned list may not
	 * carry rules — when the slug is already taken in the scope it has to be unique in, or when neither
	 * the input nor the request states an organization.
	 */
	public async create(entity: DeepPartial<Collection>): Promise<Collection> {
		// The GraphQL input declares no organization and the base class stamps only the tenant, so a collection
		// created without one belongs to the caller's organization — the scope every read of it is answered
		// inside. It was written with a NULL organization and no read ever found it again (review R2-23). An
		// organization the request stated is kept: REST validates it against the caller. With neither, there
		// is no organization it could be found in, so it is refused rather than written unreachable.
		// REST also accepts the relation form `organization: { id }`, which its DTO validates the same way.
		const organizationId =
			entity.organizationId ??
			(entity.organization as { id?: string } | undefined)?.id ??
			RequestContext.currentOrganizationId();

		if (!organizationId) {
			throw new BadRequestException(
				'A collection belongs to an organization: state one, or select one for the request.'
			);
		}

		if (entity.customerId && entity.type && entity.type !== CollectionType.MANUAL) {
			throw new BadRequestException(
				'A collection owned by a customer is a saved list and cannot be rule-based. Create it as MANUAL.'
			);
		}

		if (entity.slug) {
			await this.assertSlugIsAvailable(entity.slug, entity.customerId ?? null);
		}

		if (entity.parentId) {
			await this.assertParentIsInOrganization(entity.parentId, organizationId);
		}

		const collection = await super.create({
			type: CollectionType.MANUAL,
			status: PublicationStatus.DRAFT,
			sortOrder: 0,
			isFeatured: false,
			...entity,
			organizationId
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
	 * A new parent goes through the same refusal `move` applies (review R2-24 (c)): `PUT /collections/:id` and
	 * `updateCollection` both reach this method with a `parentId`, and neither checked it — a collection could
	 * be made its own parent, or a child of its own descendant, and every walk up the tree from it then never
	 * ended.
	 *
	 * The new parent has to be a collection of the same organization: the base class refuses another
	 * tenant's row, not another organization's of the same tenant.
	 *
	 * @param id Id of the collection.
	 * @param entity The fields to change.
	 * @returns The updated collection.
	 * @throws BadRequestException When the new parent is not a collection of the same organization, or would
	 * put the collection in a cycle.
	 */
	public async update(id: ID, entity: DeepPartial<Collection>): Promise<Collection> {
		const collection = await this.findOneByIdString(id);

		if (entity.slug && entity.slug !== collection.slug) {
			await this.assertSlugIsAvailable(entity.slug, entity.customerId ?? collection.customerId ?? null, id);
		}

		if (entity.parentId && entity.parentId !== collection.parentId) {
			await this.assertParentIsInOrganization(entity.parentId, collection.organizationId);
			await this.assertParentKeepsTreeAcyclic(id, entity.parentId);

			// The parent goes first and alone, so a re-parent a concurrent move turned into a cycle is undone
			// before anything else of this update is written.
			const others: DeepPartial<Collection> = { ...entity };

			delete others.parentId;

			await this.writeParent(id, entity.parentId as ID, collection.parentId ?? null);

			if (Object.keys(others).length) {
				await super.update(id, others);
			}
		} else {
			await super.update(id, entity);
		}

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
			const collection = await this.findOneByIdString(id);

			await this.assertParentIsInOrganization(parentId, collection.organizationId);
			await this.assertParentKeepsTreeAcyclic(id, parentId);
			await this.writeParent(id, parentId, collection.parentId ?? null);
		} else {
			await super.update(id, { parentId });
		}

		const moved = await this.findOneByIdString(id);

		await this.eventBus.publish(CollectionChangedEvent.from(moved));

		return moved;
	}

	/**
	 * Reads a merchandising collection by its slug for the caller's organization.
	 *
	 * Only a merchandising collection (`customerId` null) is addressed by slug: its slug is the one unique
	 * within the organization (`UQ_collection_org_slug`). A buyer's saved list is unique only for its owner
	 * (`UQ_collection_customer_slug`), so several saved lists — and a merchandising collection — may share a
	 * slug, and a lookup that did not exclude them could answer with any one of them, including another
	 * buyer's list (R5-06). A saved list is read by its id.
	 *
	 * @param slug The slug to look up.
	 * @returns The collection.
	 * @throws NotFoundException When no merchandising collection of the caller's organization carries the slug.
	 */
	public async findBySlug(slug: string): Promise<Collection> {
		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		if (!organizationId) {
			throw new BadRequestException('A collection cannot be read without an organization in context.');
		}

		const where: FindOptionsWhere<Collection> = { slug, organizationId, customerId: IsNull() };

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
	 * Refuses a parent that is not a live collection of the given organization.
	 *
	 * @param parentId The proposed parent.
	 * @param organizationId The organization of the collection being given the parent.
	 * @throws BadRequestException When no such collection exists in the caller's tenant and that organization.
	 */
	private async assertParentIsInOrganization(parentId: ID, organizationId: ID | undefined): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const parent = await this.typeOrmCollectionRepository.findOne({
			where: { id: parentId, organizationId, ...(tenantId ? { tenantId } : {}) },
			select: { id: true }
		});

		if (!parent) {
			throw new BadRequestException('The parent collection was not found in this organization.');
		}
	}

	/**
	 * Writes a new parent and re-runs the cycle walk on the written state.
	 *
	 * The walk before the write cannot see a concurrent one: two requests that each move one of two collections
	 * under the other both pass it before either writes, and both writes would land. Walking again after the
	 * write closes that — the later of two such writes sees both, finds the cycle, and puts its own row back —
	 * without a lock the three databases would each take differently.
	 *
	 * @param id The collection being re-parented.
	 * @param parentId The new parent.
	 * @param previousParentId The parent it had, restored when the write formed a cycle.
	 * @throws BadRequestException When the written parent closed a cycle.
	 */
	private async writeParent(id: ID, parentId: ID, previousParentId: ID | null): Promise<void> {
		await super.update(id, { parentId });

		if (await this.isDescendantOf(parentId, id)) {
			await super.update(id, { parentId: previousParentId });

			throw new BadRequestException(
				'A collection cannot be moved under one of its own descendants; a concurrent move made this one a cycle.'
			);
		}
	}

	/**
	 * Refuses a parent that would put the collection in a cycle: itself, or one of its own descendants.
	 *
	 * @param id The collection being given a parent.
	 * @param parentId The parent it is given.
	 * @throws BadRequestException When the parent is the collection or sits below it.
	 */
	private async assertParentKeepsTreeAcyclic(id: ID, parentId: ID): Promise<void> {
		if (parentId === id) {
			throw new BadRequestException('A collection cannot be its own parent.');
		}

		if (await this.isDescendantOf(parentId, id)) {
			throw new BadRequestException(
				'A collection cannot be moved under one of its own descendants; that would create a cycle.'
			);
		}
	}

	/**
	 * @param candidateId The id being tested as a descendant.
	 * @param ancestorId The id being tested as an ancestor.
	 * @returns True when `candidateId` sits below `ancestorId` in the tree. The walk reads the caller's tenant
	 * only — a parent chain never leaves it, because a foreign parent is refused on write — and it stops at a
	 * collection it has already visited, so a chain that is already cyclic (written before the update path
	 * refused one) ends the walk instead of looping forever.
	 */
	private async isDescendantOf(candidateId: ID, ancestorId: ID): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		let visited = new Set<ID>();
		let current: ID | undefined | null = candidateId;

		while (current && !visited.has(current)) {
			if (current === ancestorId) {
				return true;
			}

			visited.add(current);

			const parent = await this.typeOrmCollectionRepository.findOne({
				where: { id: current, ...(tenantId ? { tenantId } : {}) },
				select: { id: true, parentId: true },
				withDeleted: true
			});

			current = parent?.parentId;
		}

		return false;
	}
}
