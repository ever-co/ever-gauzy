// cspell:ignore organizationcontact
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	OnModuleInit,
	Optional
} from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { COMMENT_PARENT_ACCESS_POLICY } from './comment-parent-access-policy.decorator';
import { CommentParentAccess, ICommentParent, ICommentParentAccessPolicy } from './comment-parent-access.types';
import { isSpellingOfRecordType } from './record-type-spelling';

/** The most records one batch read of a policy names (`readableParentIds`), far from any bound-parameter limit. */
export const COMMENT_PARENT_BATCH = 500;
/** The records read at a time when a policy has no batch read. */
export const COMMENT_PARENT_READ_CONCURRENCY = 8;

/**
 * The registry of comment-parent policies, and the check every governed comment read or write goes through.
 *
 * Policies are discovered at boot among all providers carrying `@CommentParentAccessPolicy()`, the way the
 * favorite services are; {@link register} adds one directly (tests, or a provider built by a factory).
 */
@Injectable()
export class CommentParentAccessService implements OnModuleInit {
	private readonly policies = new Map<string, ICommentParentAccessPolicy>();

	constructor(
		@Optional() private readonly discoveryService?: DiscoveryService,
		@Optional() private readonly reflector?: Reflector
	) {}

	onModuleInit(): void {
		if (!this.discoveryService || !this.reflector) {
			return;
		}
		for (const { instance, metatype } of this.discoveryService.getProviders()) {
			if (instance && metatype && this.reflector.get(COMMENT_PARENT_ACCESS_POLICY, metatype)) {
				this.register(instance as ICommentParentAccessPolicy);
			}
		}
	}

	/**
	 * Adds a policy. One record type has one policy: a second policy class for it is a wiring mistake and fails
	 * boot rather than silently replacing the first. Another instance of the same class (a provider listed by two
	 * modules) is the same rule, and the first one is kept.
	 */
	register(policy: ICommentParentAccessPolicy): void {
		const existing = this.policies.get(policy.entity);
		if (existing) {
			if (existing.constructor !== policy.constructor) {
				throw new Error(`A comment access policy for "${policy.entity}" is already registered.`);
			}
			return;
		}
		this.policies.set(policy.entity, policy);
	}

	/** The record types whose comments a policy governs, each as its policy spells it. */
	governedEntities(): BaseEntityEnum[] {
		return [...this.policies.keys()] as BaseEntityEnum[];
	}

	/**
	 * The governed record type `entity` names, or `undefined` when it names none.
	 *
	 * Any spelling a database could take for a governed type names it (see {@link isSpellingOfRecordType}), so a
	 * comment stored under `organizationcontact` follows the contact policy wherever it is read or changed.
	 */
	governedTypeOf(entity: unknown): BaseEntityEnum | undefined {
		return this.policyFor(entity)?.entity;
	}

	/** Whether the comments of `entity`, in any spelling of a governed type, are governed by a policy. */
	isGoverned(entity: unknown): boolean {
		return this.policyFor(entity) !== undefined;
	}

	/**
	 * Refuses a new comment whose record type is a governed type spelled otherwise than its policy spells it.
	 *
	 * Such a comment would be checked as that record's comment yet stored under a value that some databases read with
	 * the record's comments and others do not. A comment on a record without a policy is not affected.
	 *
	 * @throws {BadRequestException} When `entity` is another spelling of a governed type.
	 */
	assertCanonical(entity: unknown): void {
		const policy = this.policyFor(entity);
		if (policy && entity !== policy.entity) {
			throw new BadRequestException(`A comment on a ${policy.entity} states its entity as "${policy.entity}".`);
		}
	}

	/**
	 * Checks that the caller may read or write the comments of one record.
	 *
	 * @returns `null` when the record type has no policy (the comment API's own rules apply, unchanged), and the
	 *          record otherwise.
	 * @throws {ForbiddenException} When the caller holds none of the policy's permissions for the access.
	 * @throws {NotFoundException} When the record is not one the caller may reach, or does not exist. The two
	 *         answer the same, so a record of another organization or tenant cannot be told from a missing one.
	 */
	async assertMay(access: CommentParentAccess, entity: unknown, entityId: unknown): Promise<ICommentParent | null> {
		const policy = this.policyFor(entity);
		if (!policy) {
			return null;
		}

		if (!this.holdsPermission(access, entity)) {
			throw new ForbiddenException(
				`You don't have permission to ${access} the comments of this ${policy.entity}.`
			);
		}

		// A write follows the policy's write rule where it has one (some readers may only read), else its read rule.
		const find =
			access === 'write' && policy.findWritableParent
				? policy.findWritableParent.bind(policy)
				: policy.findAccessibleParent.bind(policy);
		const parent = typeof entityId === 'string' && isUUID(entityId) ? await find(entityId as ID) : null;
		if (!parent) {
			throw new NotFoundException(`${policy.entity} not found.`);
		}

		return parent;
	}

	/**
	 * The records among `entityIds`, of one record type, whose comments the caller may read: what
	 * `assertMay('read', entity, id)` admits, for many records at once — through the policy's batch read when it has
	 * one (one read per {@link COMMENT_PARENT_BATCH} records), else {@link COMMENT_PARENT_READ_CONCURRENCY} reads at a
	 * time. A record type without a policy, a caller without its read permissions, or an id that is not a UUID answers
	 * none. A read that fails throws (the caller refuses rather than guesses).
	 */
	async readableParentIds(entity: unknown, entityIds: readonly unknown[]): Promise<Set<string>> {
		const readable = new Set<string>();
		const policy = this.policyFor(entity);
		if (!policy || !this.holdsPermission('read', entity)) {
			return readable;
		}
		const ids = [...new Set(entityIds.filter((id): id is string => typeof id === 'string' && isUUID(id)))];
		const asked = new Set(ids);
		const batchRead = policy.findAccessibleParents?.bind(policy);
		const size = batchRead ? COMMENT_PARENT_BATCH : COMMENT_PARENT_READ_CONCURRENCY;
		for (let start = 0; start < ids.length; start += size) {
			const slice = ids.slice(start, start + size) as ID[];
			const parents = batchRead
				? await batchRead(slice)
				: await Promise.all(slice.map((id) => policy.findAccessibleParent(id)));
			for (const parent of parents) {
				if (parent && asked.has(String(parent.id))) readable.add(String(parent.id));
			}
		}
		return readable;
	}

	/**
	 * Whether the caller may write the comments of one record: the policy's write permission, and its write rule for
	 * that record where it has one (a reader the record admits only to read is refused). A record type without a
	 * policy, or a record the caller may not reach, answers `false`; a read that fails throws.
	 */
	async mayWrite(entity: unknown, entityId: unknown): Promise<boolean> {
		const policy = this.policyFor(entity);
		if (!policy || !this.holdsPermission('write', entity)) {
			return false;
		}
		if (typeof entityId !== 'string' || !isUUID(entityId)) {
			return false;
		}
		// As `assertMay('write', …)` decides it: the write rule where the policy has one, else the read rule.
		const parent = policy.findWritableParent
			? await policy.findWritableParent(entityId as ID)
			: await policy.findAccessibleParent(entityId as ID);
		return parent !== null;
	}

	/**
	 * Whether the policy of `entity` has a write rule of its own for each record (a page shared to view only takes no
	 * comments), beyond the permission it asks. A record type without a policy answers `false`.
	 */
	hasWriteRule(entity: unknown): boolean {
		return typeof this.policyFor(entity)?.findWritableParent === 'function';
	}

	/**
	 * Whether the caller holds one of the permissions the policy of `entity` asks for the access. No record is read;
	 * a record type without a policy answers `false`.
	 */
	holdsPermission(access: CommentParentAccess, entity: unknown): boolean {
		const policy = this.policyFor(entity);
		if (!policy) {
			return false;
		}
		const permissions = access === 'read' ? policy.readPermissions : policy.writePermissions;
		return RequestContext.hasAnyPermission([...permissions]);
	}

	/** The policy of the governed type `entity` names, in its own spelling or any other. */
	private policyFor(entity: unknown): ICommentParentAccessPolicy | undefined {
		if (typeof entity !== 'string') {
			return undefined;
		}
		const exact = this.policies.get(entity);
		if (exact) {
			return exact;
		}
		for (const [type, policy] of this.policies) {
			if (isSpellingOfRecordType(entity, type)) {
				return policy;
			}
		}
		return undefined;
	}
}
