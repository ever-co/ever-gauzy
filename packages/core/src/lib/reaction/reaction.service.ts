import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In, SaveOptions, UpdateResult } from 'typeorm';
import {
	ICommentReactionsFindInput,
	ID,
	IPagination,
	IReaction,
	IReactionCreateInput,
	IReactionSummary,
	IReactionUpdateInput,
	ReactionEntityEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { RequestContext } from '../core/context/request-context';
import { LegacyFindManyOptions, LegacyFindOneOptions } from '../core/utils';
import { EmployeeService } from '../employee/employee.service';
import { CommentService } from '../comment/comment.service';
import { Reaction } from './reaction.entity';
import { CHAT_REACTIONS_REFUSAL, isChatReaction, withoutChatReactions } from './reaction-chat-scope';
import { summarizeReactions } from './reaction-summary';
import { TypeOrmReactionRepository } from './repository/type-orm-reaction.repository';
import { MikroOrmReactionRepository } from './repository/mikro-orm-reaction.repository';

/** At most this many comments per reaction read: an `IN` list stays well under every dialect's parameter limit. */
const SUMMARY_ID_CHUNK = 500;

/** Whether a reaction (or a reaction's input) is on a comment. */
function isCommentReaction(reaction: { entity?: unknown } | null | undefined): boolean {
	return String(reaction?.entity) === String(ReactionEntityEnum.Comment);
}

/**
 * The generic reaction surface (`/reaction` and the `reaction*` GraphQL fields): every kind of reaction but a chat
 * message's. A chat message's reactions are read and written through the chat API only, which checks the caller's
 * membership of the conversation (its service reads the `reaction` rows itself, never through this one). Here they
 * are left out of every list and count, read by id as reactions that do not exist (so withdrawing or restoring one
 * answers 404), refused to `create` and `update` (400), and not deleted by `delete`.
 */
@Injectable()
export class ReactionService extends TenantAwareCrudService<Reaction> {
	constructor(
		readonly typeOrmReactionRepository: TypeOrmReactionRepository,
		readonly mikroOrmReactionRepository: MikroOrmReactionRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _commentService: CommentService
	) {
		super(typeOrmReactionRepository, mikroOrmReactionRepository);
	}

	/**
	 * The reactions on the comments of one record (`GET /reaction/comments`), grouped by comment and emoji.
	 *
	 * The comments are the ones the caller can list: they are read through `CommentService.find`, under the comment
	 * list's own rules (a governed record's policy, the employee scope of a caller who may not act for others). The
	 * reactions of those comments are then read across reactors, since a count of one's own reactions is no count:
	 * the generic list keeps a caller without CHANGE_SELECTED_EMPLOYEE to their own rows. A chat message's reactions
	 * are never among them (the condition names comments).
	 *
	 * @param input - The record (`entity`, `entityId`) and the caller's organization.
	 * @returns One summary per comment and emoji, comments oldest first, emojis in the order first used.
	 */
	public async summarizeCommentReactions(input: ICommentReactionsFindInput): Promise<IReactionSummary[]> {
		const { entity, entityId, organizationId } = input;
		const comments = await this._commentService.find({
			where: { entity, entityId, ...(organizationId ? { organizationId } : {}) },
			order: { createdAt: 'ASC' }
		} as never);
		const commentIds = (comments ?? []).map((comment) => comment?.id).filter((id): id is ID => Boolean(id));
		if (commentIds.length === 0) {
			return [];
		}

		const reactions: Reaction[] = [];
		for (let start = 0; start < commentIds.length; start += SUMMARY_ID_CHUNK) {
			const chunk = commentIds.slice(start, start + SUMMARY_ID_CHUNK);
			const rows = await this.withoutEmployeeFilter(() =>
				super.find({
					where: { entity: ReactionEntityEnum.Comment, entityId: In(chunk) } as FindOptionsWhere<Reaction>,
					relations: { employee: { user: true } }
				})
			);
			reactions.push(...(rows ?? []));
		}

		return summarizeReactions(reactions, commentIds, this.callerEmployeeId());
	}

	/**
	 * Lists reactions (`GET /reaction`, `reactions`) — never a chat message's. See {@link withoutChatReactions}.
	 *
	 * @param filter - The caller's options; their condition is kept.
	 * @returns The reactions.
	 */
	public async findAll(filter?: LegacyFindManyOptions<Reaction>): Promise<IPagination<Reaction>> {
		return super.findAll({ ...(filter ?? {}), where: withoutChatReactions(filter?.where) });
	}

	/**
	 * Lists a page of reactions (`GET /reaction/pagination`) — never a chat message's.
	 *
	 * @param filter - The caller's options; their condition is kept.
	 * @returns The page.
	 */
	public async paginate(filter?: LegacyFindManyOptions<Reaction>): Promise<IPagination<Reaction>> {
		return super.paginate({ ...(filter ?? {}), where: withoutChatReactions(filter?.where) });
	}

	/**
	 * Counts reactions (`GET /reaction/count`, `reactionCount`) — never a chat message's.
	 *
	 * @param options - The caller's condition; it is kept.
	 * @returns The count.
	 */
	public async countBy(options?: FindOptionsWhere<Reaction>): Promise<number> {
		return super.countBy(withoutChatReactions(options));
	}

	/**
	 * Reads one reaction (`GET /reaction/:id`, `reaction`, and the ownership read of withdrawing and restoring one):
	 * a chat message's answers 404, as a reaction that does not exist.
	 *
	 * @param id - The reaction.
	 * @param options - The caller's options; their condition is kept.
	 * @returns The reaction.
	 */
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<Reaction>): Promise<Reaction> {
		return super.findOneByIdString(id, { ...(options ?? {}), where: withoutChatReactions(options?.where) });
	}

	/**
	 * Creates a reaction based on the provided input. If a reaction matching the given criteria
	 * already exists, the function will delete (toggle) the reaction instead.
	 *
	 * @param input - The input data required to create a reaction.
	 * @returns A Promise resolving to the created reaction, or void if the reaction was toggled (deleted).
	 */
	async create(input: IReactionCreateInput): Promise<IReaction> {
		// A chat message's reactions are written through the chat API only, which checks the caller's membership of
		// the conversation; the generic route knows nothing of that and refuses the kind.
		if (isChatReaction(input)) {
			throw new BadRequestException(CHAT_REACTIONS_REFUSAL);
		}
		// A comment is reacted to by those who can read it: the read answers 404 (or 403 for a governed record)
		// exactly as `GET /comment/:id` would, before anything is written.
		if (isCommentReaction(input) && this._commentService) {
			await this._commentService.findReadableById(input.entityId);
		}
		try {
			// Extract the tenantId from the input data or the current request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// The reacting employee is the caller's OWN employee record. currentEmployeeId() is
			// deliberately null for CHANGE_SELECTED_EMPLOYEE holders, so read the identity off the JWT
			// user as well; without any employee identity there is nobody to react as (update() and
			// delete() below already enforce this). A null here used to be dropped from the toggle
			// criteria, matching — and deleting — every other employee's identical reaction.
			const employeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
			if (!employeeId) {
				throw new BadRequestException('Employee ID not found in context');
			}
			// Destructure additional properties from input
			const { entity, entityId, emoji, organizationId } = input;

			// Validate employee existence
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				console.error(`[Reaction Create] Employee not found with ID: ${employeeId}`);
				throw new NotFoundException('Employee not found');
			}

			// Define search criteria for an existing reaction (for toggling)
			const whereOptions: FindOptionsWhere<Reaction> = {
				emoji,
				employeeId,
				entity,
				entityId,
				tenantId,
				organizationId
			};

			// Check if a matching reaction already exists (non-throwing lookup: findOneByWhereOptions
			// raises NotFound when there is none, which turned every FIRST reaction into a 400).
			const { success, record: reaction, error: lookupError } = await this.findOneOrFailByWhereOptions(whereOptions);
			if (!success && !(lookupError instanceof NotFoundException)) {
				// Anything but "no such reaction" is a real failure — do not fall through to a duplicate create.
				throw lookupError;
			}

			// If a matching reaction exists, delete (toggle off) the reaction
			if (reaction) {
				await super.delete(whereOptions);
				await this.announce({ entity, entityId });
				return;
			}

			// Otherwise, create a new reaction with the provided details and additional context info
			const created = await super.create({
				...input,
				employeeId,
				organizationId,
				tenantId
			});
			await this.announce(created ?? { entity, entityId });
			return created;
		} catch (error) {
			console.log('[Reaction Create] Error during reaction creation process:', error);
			throw new BadRequestException('Reaction post failed', error);
		}
	}

	/**
	 * Updates a reaction based on the provided id and update input.
	 * It ensures that the reaction exists and belongs to the current employee.
	 *
	 * @param id - The unique identifier of the reaction.
	 * @param input - The update data for the reaction.
	 * @returns A Promise that resolves to the updated reaction or an UpdateResult.
	 * @throws BadRequestException if the employee or tenant context is missing,
	 *         or if the reaction is not found.
	 */
	async update(id: ID, input: IReactionUpdateInput): Promise<IReaction | UpdateResult> {
		try {
			// Retrieve tenantId from the current context or fallback to the input tenantId.
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is missing from the request context.');
			}

			// Retrieve the current employee ID from the request context.
			const employeeId = RequestContext.currentEmployeeId();
			if (!employeeId) {
				throw new BadRequestException('Employee ID not found in context');
			}

			// Find the reaction by its ID, ensuring it belongs to the current employee.
			const reaction = await this.findOneByWhereOptions({ id, employeeId });
			if (!reaction) {
				console.error(`[ReactionUpdate] Reaction not found for id: ${id} and employeeId: ${employeeId}`);
				throw new BadRequestException('Reaction not found');
			}
			// Even the caller's own reaction to a chat message: the chat API checks they are still in the conversation.
			if (isChatReaction(reaction)) {
				throw new BadRequestException(CHAT_REACTIONS_REFUSAL);
			}

			// Update the reaction using the provided input along with the employee and tenant IDs.
			const updated = await super.update(id, { ...input, employeeId, tenantId });
			await this.announce(reaction);
			return updated;
		} catch (error) {
			if (error instanceof BadRequestException && error.message === CHAT_REACTIONS_REFUSAL) {
				throw error;
			}
			console.error('[ReactionUpdate] Error during reaction update process:', error);
			throw new BadRequestException('Reaction update failed', error);
		}
	}

	/**
	 * Deletes a reaction by its ID, ensuring that the reaction belongs to the current employee and tenant.
	 *
	 * @param id - The unique identifier of the reaction to be deleted.
	 * @returns A Promise that resolves to the result of the deletion operation.
	 * @throws BadRequestException if the deletion fails or if the employee/tenant context is missing.
	 */
	async delete(id: ID): Promise<DeleteResult> {
		try {
			// Retrieve tenant and employee IDs from the request context.
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is missing from the request context.');
			}

			const employeeId = RequestContext.currentEmployeeId();
			if (!employeeId) {
				throw new BadRequestException('Employee ID is missing from the request context.');
			}

			// Which comment loses a reaction is read before the row goes (only when it is a comment's).
			const commentId = await this.commentOfOwnReaction(id, employeeId);

			// Execute the deletion using the parent class method, scoped by tenant and employee. A reaction to a chat
			// message is taken back through the chat API, and is left alone here as one that does not exist.
			const result = await super.delete(id, { where: withoutChatReactions<Reaction>({ employeeId, tenantId }) });
			if (commentId && result?.affected) {
				await this.announce({ entity: ReactionEntityEnum.Comment, entityId: commentId });
			}
			return result;
		} catch (error) {
			// The id is an argument, not part of the format string: a `%` in it must not read as a placeholder.
			console.error('[ReactionDelete] Failed to delete reaction with id: %s. Error:', id, error);
			throw new BadRequestException('Reaction deletion failed', error);
		}
	}

	/**
	 * Withdraws a reaction (`DELETE /reaction/:id/soft`, `softDeleteReaction`) on the terms `update` and `delete`
	 * act on: only a reaction of the caller's own employee record. See {@link assertOwnReaction}.
	 *
	 * @param id - The reaction to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn reaction.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Reaction>, saveOptions?: SaveOptions): Promise<Reaction> {
		await this.assertOwnReaction(id, false);

		const removed = await super.softRemove(id, options, saveOptions);
		await this.announce(removed);
		return removed;
	}

	/**
	 * Restores a withdrawn reaction (`PUT /reaction/:id/recover`, `recoverReaction`) on the same terms.
	 *
	 * @param id - The reaction to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored reaction.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Reaction>, saveOptions?: SaveOptions): Promise<Reaction> {
		await this.assertOwnReaction(id, true);

		const recovered = await super.softRecover(id, options, saveOptions);
		await this.announce(recovered);
		return recovered;
	}

	/**
	 * The rule `update` and `delete` apply, applied to withdrawing and restoring (owner decision 5, 2026-10-13:
	 * these routes stay equal to `update` — which states no permission, and enforces this instead).
	 *
	 * The CRUD base's scope drops the employee for a CHANGE_SELECTED_EMPLOYEE holder and falls back to the whole
	 * tenant for a caller with no employee record, so either could withdraw or restore anybody's reaction. Like
	 * `update` and `delete`, this requires the caller's own employee in the request context (refused with the
	 * same 400 when there is none) and reads the reaction with that employee stated, so another employee's answers
	 * 404 — among withdrawn rows when the act is a restoration. The refusal is raised before the base method runs,
	 * because the base rethrows whatever fails inside it as a 404.
	 *
	 * @param id - The reaction acted on.
	 * @param withDeleted - Whether the reaction is read among withdrawn rows (a restoration).
	 * @throws {BadRequestException} When the request carries no employee of the caller's own.
	 * @throws {NotFoundException} When the reaction is not the caller's own.
	 */
	private async assertOwnReaction(id: ID, withDeleted: boolean): Promise<void> {
		const employeeId = RequestContext.currentEmployeeId();
		if (!employeeId) {
			throw new BadRequestException('Employee ID not found in context');
		}

		await this.findOneByIdString(id, {
			where: { employeeId } as FindOptionsWhere<Reaction>,
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * The caller's own employee: `currentEmployeeId()` is null for a CHANGE_SELECTED_EMPLOYEE holder, so the JWT user's
	 * employee is read as well (as `create` does).
	 */
	private callerEmployeeId(): ID | undefined {
		return RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? undefined;
	}

	/**
	 * Tells the comment's readers that its reactions changed (`CommentService.announceReactionChange`), when the
	 * reaction is a comment's. Never fails the write it follows. A service built without the comment module (a unit
	 * test's) announces nothing.
	 */
	private async announce(reaction: Partial<Pick<IReaction, 'entity' | 'entityId'>> | null | undefined): Promise<void> {
		if (!this._commentService || !isCommentReaction(reaction) || !reaction?.entityId) {
			return;
		}
		try {
			await this._commentService.announceReactionChange(reaction.entityId);
		} catch (error) {
			console.warn('[Reaction] The comment change was not announced: %s', (error as Error)?.message);
		}
	}

	/**
	 * The comment a reaction of the caller's own is on, or `null` when it is not a comment's (or cannot be read).
	 */
	private async commentOfOwnReaction(id: ID, employeeId: ID): Promise<ID | null> {
		if (!this._commentService) {
			return null;
		}
		try {
			const { record } = await this.findOneOrFailByWhereOptions({
				id,
				employeeId,
				entity: ReactionEntityEnum.Comment
			} as FindOptionsWhere<Reaction>);
			return record?.entityId ?? null;
		} catch {
			return null;
		}
	}
}
