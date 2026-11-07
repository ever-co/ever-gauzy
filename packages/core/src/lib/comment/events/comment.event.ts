import { IEvent } from '@nestjs/cqrs';
import { BaseEntityEnum, ID } from '@gauzy/contracts';

/** What happened to the comment a {@link CommentEvent} names. */
export type CommentEventType = 'created' | 'updated' | 'deleted';

/** The members of a comment an event carries: enough to say which record's comments changed, never the text. */
export interface ICommentEventComment {
	id: ID;
	entity?: BaseEntityEnum | string;
	entityId?: ID;
	parentId?: ID | null;
	tenantId?: ID;
	organizationId?: ID | null;
}

/**
 * Published on the CQRS event bus by `CommentService` after a comment is created, updated or deleted.
 *
 * It is the in-process fact the real-time channel turns into a `comment.*` change hint. The comment's text
 * is deliberately not part of it: a subscriber refetches the comment through the comment API, which
 * applies the record's own access rules.
 */
export class CommentEvent implements IEvent {
	constructor(
		public readonly type: CommentEventType,
		public readonly comment: ICommentEventComment,
		/** The user whose request caused the change, when known. */
		public readonly actorUserId?: ID | null
	) {}
}
