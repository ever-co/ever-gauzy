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

		const parent =
			typeof entityId === 'string' && isUUID(entityId) ? await policy.findAccessibleParent(entityId as ID) : null;
		if (!parent) {
			throw new NotFoundException(`${policy.entity} not found.`);
		}

		return parent;
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
