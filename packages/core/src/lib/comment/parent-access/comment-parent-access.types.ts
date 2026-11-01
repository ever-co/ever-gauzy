import { BaseEntityEnum, ID, PermissionsEnum } from '@gauzy/contracts';

/**
 * What a comment-parent policy reports about the record a comment thread hangs on, once the caller has been
 * found to reach it.
 */
export interface ICommentParent {
	id: ID;
	/**
	 * The record's organization: a comment posted on it is stored in the same one. `null` for a record of the whole
	 * tenant, whose comments then belong to no organization either.
	 */
	organizationId: ID | null;
}

/** Whether a comment of a governed record is being read, or written (posted, edited, withdrawn, removed). */
export type CommentParentAccess = 'read' | 'write';

/**
 * The rule that governs the comments of one kind of record.
 *
 * A comment hangs off any record through `(entity, entityId)`, and the comment API itself only keeps a caller
 * inside their tenant. A record whose comments must follow the record's own access rules — a contact's notes
 * are readable only by those who may view the contact — declares a policy: a provider decorated with
 * `@CommentParentAccessPolicy()`, which the comment service discovers at boot. Records without a policy keep the
 * comment API's own rules, unchanged.
 *
 * - `readPermissions` / `writePermissions` are alternatives: holding any one of them is enough.
 * - `findAccessibleParent` answers the record when the caller may reach it (same tenant, same organization, and
 *   whatever visibility rule the record's own read applies), and `null` when they may not or it does not exist.
 */
export interface ICommentParentAccessPolicy {
	readonly entity: BaseEntityEnum;
	readonly readPermissions: ReadonlyArray<PermissionsEnum>;
	readonly writePermissions: ReadonlyArray<PermissionsEnum>;
	findAccessibleParent(entityId: ID): Promise<ICommentParent | null>;
}
