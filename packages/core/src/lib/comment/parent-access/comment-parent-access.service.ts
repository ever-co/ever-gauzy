import { ForbiddenException, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { COMMENT_PARENT_ACCESS_POLICY } from './comment-parent-access-policy.decorator';
import { CommentParentAccess, ICommentParent, ICommentParentAccessPolicy } from './comment-parent-access.types';

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

	/** The record types whose comments a policy governs. */
	governedEntities(): BaseEntityEnum[] {
		return [...this.policies.keys()] as BaseEntityEnum[];
	}

	/** Whether the comments of `entity` are governed by a policy. */
	isGoverned(entity: unknown): boolean {
		return typeof entity === 'string' && this.policies.has(entity);
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
		const policy = this.isGoverned(entity) ? this.policies.get(entity as string) : undefined;
		if (!policy) {
			return null;
		}

		const permissions = access === 'read' ? policy.readPermissions : policy.writePermissions;
		if (!RequestContext.hasAnyPermission([...permissions])) {
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
}
