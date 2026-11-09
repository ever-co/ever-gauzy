import { And, Equal, FindOperator, FindOptionsWhere, Not } from 'typeorm';
import { ReactionEntityEnum } from '@gauzy/contracts';

/** Why the generic reaction routes refuse to write a chat message's reaction. */
export const CHAT_REACTIONS_REFUSAL = 'Reactions to chat messages are managed through the chat API.';

/** Whether a reaction is a chat message's (read and written through the chat API only). */
export function isChatReaction(reaction: { entity?: unknown } | null | undefined): boolean {
	return String(reaction?.entity) === String(ReactionEntityEnum.ChatMessage);
}

/**
 * A condition with the reactions to chat messages left out, the caller's own condition on `entity` kept beside it:
 * `entity = 'Task'` still reads the Task reactions, and `entity = 'ChatMessage'` reads none. Each alternative of a
 * list gets it; an empty list (which the CRUD base reads as no condition) becomes the one condition.
 *
 * @param where - The caller's condition, if any.
 * @returns The condition the read runs with.
 */
export function withoutChatReactions<T>(where?: FindOptionsWhere<T>): FindOptionsWhere<T>;
export function withoutChatReactions<T>(
	where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
): FindOptionsWhere<T> | FindOptionsWhere<T>[];
export function withoutChatReactions<T>(
	where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
	if (Array.isArray(where)) {
		return where.length
			? where.map((alternative) => withoutChatReactions<T>(alternative))
			: withoutChatReactions<T>();
	}
	const notChat = Not(ReactionEntityEnum.ChatMessage);
	const stated = (where as { entity?: unknown } | undefined)?.entity;
	if (stated === undefined || stated === null) {
		return { ...(where ?? {}), entity: notChat } as unknown as FindOptionsWhere<T>;
	}
	const kept =
		stated instanceof FindOperator
			? (stated as FindOperator<ReactionEntityEnum>)
			: Equal(stated as ReactionEntityEnum);
	return { ...where, entity: And(kept, notChat) } as unknown as FindOptionsWhere<T>;
}
