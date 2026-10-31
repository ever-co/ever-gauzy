import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOperator, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import { isUUID } from 'class-validator';
import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { LegacyFindManyOptions, LegacyFindOneOptions } from '../core/utils';
import { RequestContext } from '../core/context';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { EmployeeService } from '../employee/employee.service';
import { MentionService } from '../mention/mention.service';
import { isCallerTenantAdmin, withoutAuthorChange } from '../shared/ownership';
import { Comment } from './comment.entity';
import { CommentParentAccessService, scopeCommentReadToParents } from './parent-access';
import { TypeOrmCommentRepository } from './repository/type-orm-comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

/**
 * The columns that say who wrote a comment and who resolved it. A body never states them on a create. On an
 * edit only a tenant administrator may, and any other caller's stated resolver is themselves.
 */
const AUTHORSHIP_COLUMNS: ReadonlyArray<string> = Object.freeze([
	'employeeId',
	'employee',
	'resolvedByEmployeeId',
	'resolvedByEmployee'
]);

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
		private readonly _eventBus: EventBus,
		private readonly _employeeService: EmployeeService,
		private readonly _mentionService: MentionService,
		private readonly _parentAccess: CommentParentAccessService
	) {
		super(typeOrmCommentRepository, mikroOrmCommentRepository);
	}

	/**
	 * Creates a new comment with the provided input, handling employee validation,
	 * publishing mention notifications, and subscribing the comment creator to the related entity.
	 *
	 * This function retrieves context-specific IDs from the RequestContext (tenant, employee)
	 * and falls back to the values in the input if necessary. It verifies that the employee exists,
	 * creates the comment, publishes mention notifications for each mentioned employee, and
	 * triggers a subscription event for the creator.
	 *
	 * @param {ICommentCreateInput} input - The input data required to create a comment, including text, mentions, and organization details.
	 * @returns {Promise<IComment>} A promise that resolves to the newly created comment.
	 * @throws {NotFoundException} If the employee associated with the comment is not found.
	 * @throws {BadRequestException} If any error occurs during the creation of the comment.
	 */
	async create(input: ICommentCreateInput): Promise<IComment> {
		try {
			// Retrieve context-specific IDs.
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// The author is the caller, and never the body. A caller with an employee record is the author.
			// A caller without one posts an author-less comment, which is owned by the user who posted it:
			// `createdByUserId` is stamped from the credential, which is the key assertMayManage manages it
			// by and the identity the ever-co/ever-gauzy#11328 ownership rule reads. The body's `employeeId`
			// used to be the fallback, so a caller with no employee record could post as any employee,
			// mention notifications included.
			const employeeId = this.callerEmployeeId();
			// Who resolved a comment is not the body's to state either, and a new comment has no resolver.
			const { mentionEmployeeIds = [], organizationId, ...data } = this.withoutAuthorship(input);

			// A record governed by a comment-access policy (a contact's notes, for one) is written only by those
			// its policy allows, under the record type as its policy spells it, and a comment on it is stored in
			// the record's own organization. Every other record keeps the rules above, unchanged.
			this._parentAccess.assertCanonical(input.entity);
			const parent = await this._parentAccess.assertMay('write', input.entity, input.entityId);
			await this.assertReplyStaysInThread(input.entity, input.entityId, input.parentId);

			// Validate that the employee exists (only a real id can be looked up — an empty one used to
			// match an arbitrary employee and pass vacuously).
			if (employeeId) {
				const employee = await this._employeeService.findOneByIdString(employeeId);
				if (!employee) {
					throw new NotFoundException(`Employee with id ${employeeId} not found`);
				}
			}

			// Create the comment. A governed record's comment takes the record's organization, and no
			// `organization` relation the body states beside it.
			const comment = await super.create({
				...(parent ? omit(data, ['organization']) : data),
				employeeId,
				tenantId,
				organizationId: parent?.organizationId ?? organizationId
			});

			// Publish mentions for each mentioned employee, if any.
			await Promise.all(
				mentionEmployeeIds.map((mentionedEmployeeId: ID) =>
					this._mentionService.publishMention({
						entity: BaseEntityEnum.Comment,
						entityId: comment.id,
						entityName: input.entityName,
						parentEntityId: comment.entityId,
						parentEntityType: comment.entity,
						mentionedEmployeeId,
						organizationId: comment.organizationId,
						tenantId: comment.tenantId
					})
				)
			);

			// Subscribe the comment created by user to the entity.
			this._eventBus.publish(
				new CreateEntitySubscriptionEvent({
					entity: input.entity,
					entityId: input.entityId,
					employeeId,
					type: EntitySubscriptionTypeEnum.COMMENT,
					organizationId: comment.organizationId,
					tenantId: comment.tenantId
				})
			);

			// Return the newly created comment.
			return comment;
		} catch (error) {
			// A missing employee (404) keeps its status; only unexpected failures become a 400
			if (error instanceof HttpException) {
				throw error;
			}
			console.log(`Error while creating comment: ${error.message}`, error);
			throw new BadRequestException('Comment post failed', error);
		}
	}

	/**
	 * Updates an existing comment based on the provided id and update input.
	 *
	 * This function first retrieves the current employee's ID from the request context,
	 * then attempts to locate the comment matching the provided id and employeeId.
	 * If the comment is found, it creates an updated version of the comment using the input data.
	 * Additionally, it synchronizes any mention updates via the _mentionService: an omitted
	 * `mentionEmployeeIds` leaves the comment's mentions as they are, and an array, `[]` included,
	 * replaces them.
	 *
	 * @param {ID} id - The unique identifier of the comment to update.
	 * @param {ICommentUpdateInput} input - The update data for the comment, including any mention updates.
	 * @returns {Promise<IComment | UpdateResult>} A promise that resolves to the updated comment or an update result.
	 * @throws {BadRequestException} If the comment is not found or if the update operation fails.
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
			const employeeId = RequestContext.currentEmployeeId();
			const canChangeSelectedEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
			const { mentionEmployeeIds } = input;

			// Find the comment for the current employee with the given id. Callers holding
			// CHANGE_SELECTED_EMPLOYEE may edit any comment of the tenant; everyone else must be the
			// author — and therefore must have an employee identity (a null key was previously just
			// dropped from the query, which let employee-less callers edit anything).
			if (!canChangeSelectedEmployee && !employeeId) {
				throw new ForbiddenException(`You don't have permission to update this comment`);
			}
			const comment = await this.findOneByWhereOptions({
				id,
				...(canChangeSelectedEmployee ? {} : { employeeId })
			});

			if (!comment) {
				throw new BadRequestException(`Comment with id ${id} not found`);
			}

			// A comment of a governed record is edited only by those its policy lets write that record's comments,
			// and a reply it is made into stays in the record's thread.
			const parent = await this._parentAccess.assertMay('write', comment.entity, comment.entityId);
			if (input.parentId !== undefined) {
				await this.assertReplyStaysInThread(comment.entity, comment.entityId, input.parentId);
			}

			// Update the comment with the new input data. Who wrote and who resolved it are not an edit's to
			// restate, by the rule every per-user row follows (ever-co/ever-gauzy#11328, withoutAuthorChange):
			// `createdByUserId` and `createdByUser` never, the author and resolver columns only by a tenant
			// administrator.
			// ICommentUpdateInput already leaves the author out, but the REST DTO still carried `employeeId`,
			// and a CHANGE_SELECTED_EMPLOYEE holder's edit wrote it. A resolver the body names is the caller.
			const updatedComment = await super.create({
				...this.keptInPlace(withoutAuthorChange(input, AUTHORSHIP_COLUMNS), comment, !!parent),
				...this.resolverStatedBy(input),
				id
			});

			// Synchronize mention updates only when the caller sent the list (a resolve or reopen does not).
			if (Array.isArray(mentionEmployeeIds)) {
				await this._mentionService.updateEntityMentions(
					BaseEntityEnum.Comment,
					id,
					mentionEmployeeIds,
					// The parent is read from the stored row: an update cannot move a comment, and the
					// TypeORM save result carries neither field
					comment.entityId,
					comment.entity,
					// The saved organization: the edit may have moved the comment to another one
					updatedComment.organizationId ?? comment.organizationId
				);
			}

			return updatedComment;
		} catch (error) {
			// A foreign comment (403) or a missing one (404, thrown by the lookup) keeps its status
			if (error instanceof HttpException) {
				throw error;
			}
			console.log(`Error while updating comment: ${error.message}`, error);
			throw new BadRequestException('Comment update failed', error);
		}
	}

	/**
	 * Lists comments (`GET /comment`, the `comments` field). See {@link readWithinParents}.
	 */
	public async findAll(filter?: LegacyFindManyOptions<Comment>): Promise<IPagination<Comment>> {
		return this.readWithinParents(filter?.where, (where) => super.findAll(withWhere(filter, where)));
	}

	/**
	 * Lists comments. See {@link readWithinParents}.
	 */
	public async find(filter?: LegacyFindManyOptions<Comment>): Promise<Comment[]> {
		return this.readWithinParents(filter?.where, (where) => super.find(withWhere(filter, where)));
	}

	/**
	 * Lists a page of comments (`GET /comment/pagination`). See {@link readWithinParents}.
	 */
	public async paginate(filter?: LegacyFindManyOptions<Comment>): Promise<IPagination<Comment>> {
		return this.readWithinParents(filter?.where, (where) => super.paginate(withWhere(filter, where)));
	}

	/**
	 * Counts comments. See {@link readWithinParents}.
	 */
	public async count(options?: LegacyFindManyOptions<Comment>): Promise<number> {
		return this.readWithinParents(options?.where, (where) => super.count(withWhere(options, where)));
	}

	/**
	 * Counts comments (`GET /comment/count`, the `commentCount` field). See {@link readWithinParents}.
	 */
	public async countBy(options?: FindOptionsWhere<Comment>): Promise<number> {
		return this.readWithinParents(options, (where) => super.countBy(where as FindOptionsWhere<Comment>));
	}

	/**
	 * Reads one comment for a caller (`GET /comment/:id`, the `comment` field).
	 *
	 * A comment of a record without a comment-access policy is read exactly as `findOneByIdString` reads it. A
	 * comment of a governed record is answered to those its policy lets read that record's comments, whoever wrote
	 * it, as the record's list is.
	 *
	 * @param id - The comment.
	 * @param options - Find options, as `findOneByIdString` takes them.
	 * @throws {NotFoundException} When the comment, or its governed record, is not one the caller may reach.
	 * @throws {ForbiddenException} When the caller may not read the comments of its governed record.
	 */
	public async findReadableById(id: ID, options?: LegacyFindOneOptions<Comment>): Promise<Comment> {
		// The rule is chosen for the comment `id` names, so the read must be of that comment: an `id` in the
		// criteria would otherwise replace it (`findOneByIdString` spreads the criteria over the id).
		const pinned = criteriaPinnedTo(id, options);
		const stored = await this.findGovernedComment(id, !!options?.withDeleted);
		if (!stored) {
			return this.findOneByIdString(id, pinned);
		}

		await this._parentAccess.assertMay('read', stored.entity, stored.entityId);
		return this.readAcrossAuthors(() => this.findOneByIdString(id, pinned));
	}

	/**
	 * Withdraws a comment (`DELETE /comment/:id/soft`, `softDeleteComment`) on the terms an edit is allowed on.
	 *
	 * See {@link assertMayManage}: the CRUD base's own scope let a caller with no employee identity who may not act
	 * for others withdraw any comment of the tenant, while `update` refuses that caller outright.
	 *
	 * @param id - The comment to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn comment.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Comment>, saveOptions?: SaveOptions): Promise<Comment> {
		await this.assertMayManage(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn comment (`PUT /comment/:id/recover`, `recoverComment`) on the terms an edit is allowed on.
	 *
	 * @param id - The comment to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored comment.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Comment>, saveOptions?: SaveOptions): Promise<Comment> {
		await this.assertMayManage(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Removes a comment (`DELETE /comment/:id`, `deleteComment`) on the terms an edit is allowed on, when it is
	 * addressed by its id — which is how both routes address it. A call with object criteria is a service-level
	 * call rather than a caller's request, and keeps the base behaviour.
	 *
	 * @param criteria - The comment's id, or criteria.
	 * @param options - Additional where conditions, passed to the base method unchanged.
	 * @returns The delete result.
	 */
	public async delete(criteria: string | FindOptionsWhere<Comment>, options?: LegacyFindOneOptions<Comment>): Promise<DeleteResult> {
		// The removal deletes the row whatever its `deletedAt`, so a withdrawn comment is still its author's to
		// remove: the ownership read includes withdrawn rows.
		if (typeof criteria === 'string') {
			await this.assertMayManage(criteria, true);
		}

		return super.delete(criteria, options);
	}

	/**
	 * The caller's own employee, or `undefined` when they have no employee record.
	 *
	 * `RequestContext.currentEmployeeId()` is deliberately null for a CHANGE_SELECTED_EMPLOYEE holder, so the JWT
	 * user's employee is read as well. It is never read from a body.
	 */
	private callerEmployeeId(): ID | undefined {
		return RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? undefined;
	}

	/**
	 * A new comment's input without the members that say who wrote or resolved it.
	 *
	 * Those are the author (`employeeId` / `employee`), the resolver (`resolvedByEmployeeId` /
	 * `resolvedByEmployee`) and the posting user (`createdByUserId` / `createdByUser`, which the base entity
	 * subscriber stamps). `CreateCommentDTO` extends the entity, so a REST body kept the identifiers through
	 * the whitelist, and the GraphQL input declares both. `create` states the author itself, for every
	 * caller, as the resource-link create does.
	 */
	private withoutAuthorship<I extends object>(input: I): I {
		const rest = { ...((input ?? {}) as Record<string, unknown>) };
		for (const column of [...AUTHORSHIP_COLUMNS, 'createdByUserId', 'createdByUser']) {
			delete rest[column];
		}

		return rest as I;
	}

	/**
	 * An edit's changes, kept from moving a comment onto or off a governed record.
	 *
	 * A governed record's comment stays on its record and in the organization it is stored in, whatever the edit
	 * states: its policy checked the caller against that record, and its readers are that record's. A comment of
	 * any other record is edited as before, except that it cannot be moved onto a governed record, which would
	 * skip that record's write check.
	 *
	 * @param changes - The edit's changes.
	 * @param stored - The comment as stored.
	 * @param governed - Whether the stored comment belongs to a governed record.
	 * @throws {BadRequestException} When the edit moves a comment onto a governed record.
	 */
	private keptInPlace<I extends object>(changes: I, stored: Comment, governed: boolean): I {
		const fields = (changes ?? {}) as Record<string, unknown>;
		if (governed) {
			return {
				...omit(fields, ['entity', 'entityId', 'organization']),
				organizationId: stored.organizationId
			} as unknown as I;
		}
		if (fields.entity !== undefined && this._parentAccess.isGoverned(fields.entity)) {
			throw new BadRequestException('A comment cannot be moved onto a record whose comments a policy governs.');
		}
		return changes;
	}

	/**
	 * Runs a read without the employee filter, in a request-context store of its own.
	 *
	 * The bypass is a counter in the request's store, and a GraphQL request resolves its fields concurrently in that
	 * one store: set there, it would also lift the filter from a comment read that another field runs meanwhile.
	 * {@link RequestContext.runIsolated} keeps it to this read.
	 */
	private readAcrossAuthors<R>(read: () => Promise<R>): Promise<R> {
		return RequestContext.runIsolated(() => this.withoutEmployeeFilter(read));
	}

	/**
	 * The resolver an edit writes, when the edit states one and the caller is not a tenant administrator.
	 *
	 * A resolver the body names is the caller's own employee, so nobody can mark a comment as resolved by
	 * a colleague. An explicit `null` (a reopen) clears the column. An edit that does not name the resolver
	 * leaves it as stored. The Documents threads resolve with `resolved` / `resolvedAt` only, so their
	 * flow is unchanged. A tenant administrator's edit keeps the resolver it states, as
	 * {@link withoutAuthorChange} keeps their author columns.
	 */
	private resolverStatedBy(input: ICommentUpdateInput): Pick<IComment, 'resolvedByEmployeeId'> {
		if (!input || input.resolvedByEmployeeId === undefined || isCallerTenantAdmin()) {
			return {};
		}

		return {
			resolvedByEmployeeId: input.resolvedByEmployeeId == null ? null : this.callerEmployeeId() ?? null
		};
	}

	/**
	 * Who may withdraw, restore or remove a comment: the rule `update` applies to whose comment a caller may change
	 * (owner decision 5, 2026-10-13: these routes stay equal to `update` — which states no permission, and enforces
	 * this instead), with one addition so that no author loses a removal they have today.
	 *
	 * - A CHANGE_SELECTED_EMPLOYEE holder may act on any comment of the tenant (the base scope keeps it to the tenant).
	 * - A caller with an employee identity may act on that employee's comments only — the read goes through the
	 *   tenant-scoped finder with the author stated, so another employee's comment answers 404.
	 * - A caller with no employee identity may act only on the comments they posted themselves (`createdByUserId`).
	 *   `create` lets such a caller post an author-less comment, and the documents UI removes a comment with
	 *   `DELETE /comment/:id`; `update` refuses them outright, but refusing the removal of their own comment
	 *   would take away a flow they have. What they lose is what the base scope wrongly gave them: every other
	 *   comment of the tenant.
	 *
	 * A restoration reads among withdrawn rows. The refusal is raised before the base method runs, because the base
	 * rethrows whatever fails inside it as a 404.
	 *
	 * @param id - The comment acted on.
	 * @param withDeleted - Whether the comment is read among withdrawn rows (a restoration, or a removal).
	 * @throws {ForbiddenException} When the caller has neither an employee identity nor a user identity.
	 * @throws {NotFoundException} When the comment is not one the caller may act on.
	 */
	private async assertMayManage(id: ID, withDeleted: boolean): Promise<void> {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Any comment of the tenant, as before; a comment of a governed record also needs its policy's write
			// permission. A missing comment is still the base method's to answer.
			const stored = await this.findGovernedComment(id, withDeleted);
			if (stored) {
				await this._parentAccess.assertMay('write', stored.entity, stored.entityId);
			}
			return;
		}

		const employeeId = RequestContext.currentEmployeeId();
		const userId = RequestContext.currentUserId();
		if (!employeeId && !userId) {
			throw new ForbiddenException(`You don't have permission to manage this comment`);
		}

		const own = (employeeId ? { employeeId } : { createdByUserId: userId }) as FindOptionsWhere<Comment>;
		const comment = await this.findOneByIdString(id, { where: own, ...(withDeleted ? { withDeleted: true } : {}) });
		if (comment) {
			await this._parentAccess.assertMay('write', comment.entity, comment.entityId);
		}
	}

	/**
	 * Runs a comment list or count read inside what the comment-access policies allow.
	 *
	 * The criteria are kept by {@link scopeCommentReadToParents}: an alternative that names one governed record
	 * (`{ entity, entityId }`) is read only when the record's policy lets the caller read its comments, and every
	 * other alternative leaves the comments of governed records out. A read whose every alternative names a governed
	 * record answers all of that record's comments, whoever wrote them (a contact's notes are the contact's, not
	 * their authors'), while every other read keeps the base scope, so the comments of other records are listed
	 * exactly as before.
	 *
	 * @param where - The read's criteria.
	 * @param read - The base read, given the criteria to run.
	 */
	private async readWithinParents<R>(where: unknown, read: (where: unknown) => Promise<R>): Promise<R> {
		const scope = scopeCommentReadToParents(where as object, this._parentAccess.governedEntities(), (entity) =>
			this._parentAccess.governedTypeOf(entity)
		);
		for (const { entity, entityId } of scope.parents) {
			await this._parentAccess.assertMay('read', entity, entityId);
		}

		return scope.onlyGovernedParents ? this.readAcrossAuthors(() => read(scope.where)) : read(scope.where);
	}

	/**
	 * The stored comment `id` when it belongs to a record governed by a comment-access policy; `undefined` when it
	 * belongs to any other record, or is not a comment of the caller's tenant and organization.
	 *
	 * The lookup reaches every comment of the caller's scope, whoever wrote it, because it only decides which rule
	 * applies: what the caller is then answered is still read through that rule.
	 */
	private async findGovernedComment(id: ID, withDeleted: boolean): Promise<Comment | undefined> {
		if (this._parentAccess.governedEntities().length === 0) {
			return undefined;
		}

		const stored = await this.readAcrossAuthors(() =>
			this.findOneByIdString(id, withDeleted ? { withDeleted: true } : {})
		).catch(undefinedWhenNotFound);

		return stored && this._parentAccess.isGoverned(stored.entity) ? stored : undefined;
	}

	/**
	 * Keeps a reply in its record's thread when either side is a comment of a governed record.
	 *
	 * A reply can be read with its parent (`relations: ['parent']`) and a comment with its replies, so a reply on
	 * another record would carry a governed record's comment out to readers its policy does not allow, or the
	 * reverse. Replies between records without a policy keep today's behaviour: nothing is checked.
	 *
	 * @param entity - The type of the record the reply belongs to.
	 * @param entityId - The record the reply belongs to.
	 * @param parentId - The comment it replies to.
	 * @throws {NotFoundException} When a governed record's reply names no comment of the tenant.
	 * @throws {BadRequestException} When the two comments do not belong to the same record.
	 */
	private async assertReplyStaysInThread(
		entity: string,
		entityId: ID,
		parentId: ID | null | undefined
	): Promise<void> {
		if (!parentId || this._parentAccess.governedEntities().length === 0) {
			return;
		}

		const governed = this._parentAccess.isGoverned(entity);
		const parent = isUUID(parentId)
			? await this.readAcrossAuthors(() =>
					this.withoutOrganizationBoundary(() => this.findOneByIdString(parentId, { withDeleted: true }))
				).catch(undefinedWhenNotFound)
			: undefined;

		if (!parent) {
			if (governed) {
				throw new NotFoundException(`Comment with id ${parentId} not found`);
			}
			return;
		}

		const sameRecord = parent.entity === entity && parent.entityId === entityId;
		if ((governed || this._parentAccess.isGoverned(parent.entity)) && !sameRecord) {
			throw new BadRequestException('A reply belongs to the same record as the comment it replies to.');
		}
	}
}

/** `filter` with `where` as its criteria, or `filter` itself when the criteria did not change. */
function withWhere<O extends { where?: unknown }>(filter: O | undefined, where: unknown): O | undefined {
	return where === filter?.where ? filter : ({ ...(filter ?? {}), where } as O);
}

/** `fields` without `keys`. */
function omit<F extends object>(fields: F, keys: ReadonlyArray<string>): F {
	const rest = { ...(fields as Record<string, unknown>) };
	for (const key of keys) {
		delete rest[key];
	}
	return rest as F;
}

/**
 * A read-by-id's options, with any `id` in their criteria replaced by the id read.
 *
 * `findOneByIdString` spreads the criteria over the id, so `where: { id: <another comment> }` read that other comment
 * under the rule chosen for the first. Criteria that are not one object cannot be kept to the id, and are refused.
 *
 * @throws {BadRequestException} When the criteria are a list, a find operator or not an object.
 */
function criteriaPinnedTo<O extends { where?: unknown }>(id: ID, options: O | undefined): O | undefined {
	const where = options?.where;
	if (where == null) {
		return options;
	}
	if (typeof where !== 'object' || Array.isArray(where) || where instanceof FindOperator) {
		throw new BadRequestException('A comment read by id states its criteria as one object.');
	}
	return 'id' in where ? ({ ...options, where: { ...where, id } } as O) : options;
}

/** A lookup's answer when the row is not there, rather than the base finder's 404. */
function undefinedWhenNotFound(error: unknown): undefined {
	if (error instanceof NotFoundException) {
		return undefined;
	}
	throw error;
}
