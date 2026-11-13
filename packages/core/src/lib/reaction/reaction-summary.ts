import { ID, IReaction, IReactionSummary, IReactionSummaryReactor, ReactionEntityEnum } from '@gauzy/contracts';

/** A reaction as the summary reads it: with the reacting employee and their user when they were loaded. */
export type SummarizedReaction = Pick<IReaction, 'id' | 'entity' | 'entityId' | 'emoji' | 'employeeId' | 'employee'> & {
	createdAt?: Date | string | null;
};

/** The name a reader sees for a reactor: the user's full name, else their user name, else nothing. */
export function reactorNameOf(reaction: SummarizedReaction): string {
	const user = reaction.employee?.user;
	const fullName = [user?.firstName, user?.lastName]
		.map((part) => (typeof part === 'string' ? part.trim() : ''))
		.filter((part) => part.length > 0)
		.join(' ');
	if (fullName) {
		return fullName;
	}
	// The e-mail is never a fallback: a reader of the comment is not owed a colleague's address.
	return typeof user?.name === 'string' ? user.name.trim() : '';
}

function timeOf(reaction: SummarizedReaction): number {
	const at = reaction.createdAt ? new Date(reaction.createdAt).getTime() : Number.NaN;
	return Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER;
}

/**
 * Groups reactions by the record they are on and their emoji.
 *
 * Records keep the order of `recordIds` (the comment order the caller read); within a record an emoji comes in the
 * order it was first used, and its reactors in the order they reacted. A reactor is counted once per emoji even if
 * the table holds a duplicate row (the toggle has no unique index behind it). `reactedByMe` and `reactionId` are the
 * caller's own reaction, read by their employee id. A row without an employee or an emoji, or of another record, is
 * left out.
 *
 * @param reactions - The reactions, in any order.
 * @param recordIds - The records the summary is for.
 * @param myEmployeeId - The caller's employee, if they have one.
 */
export function summarizeReactions(
	reactions: ReadonlyArray<SummarizedReaction>,
	recordIds: ReadonlyArray<ID>,
	myEmployeeId?: ID | null
): IReactionSummary[] {
	const order = new Map<ID, number>(recordIds.map((id, index) => [id, index]));
	const sorted = reactions
		.filter((reaction) => order.has(reaction.entityId) && typeof reaction.emoji === 'string' && reaction.emoji)
		.slice()
		.sort((first, second) => timeOf(first) - timeOf(second));

	const groups = new Map<string, IReactionSummary & { seen: Set<ID> }>();
	for (const reaction of sorted) {
		const employeeId = reaction.employeeId ?? reaction.employee?.id;
		if (!employeeId) {
			continue;
		}
		// A record id is a UUID, so the first colon ends it whatever the emoji holds.
		const key = `${reaction.entityId}:${reaction.emoji}`;
		let group = groups.get(key);
		if (!group) {
			group = {
				entity: (reaction.entity as ReactionEntityEnum) ?? ReactionEntityEnum.Comment,
				entityId: reaction.entityId,
				emoji: reaction.emoji,
				count: 0,
				reactedByMe: false,
				reactionId: null,
				reactors: [],
				seen: new Set<ID>()
			};
			groups.set(key, group);
		}
		if (group.seen.has(employeeId)) {
			continue;
		}
		group.seen.add(employeeId);
		group.count += 1;
		const reactor: IReactionSummaryReactor = {
			employeeId,
			name: reactorNameOf(reaction),
			imageUrl: reaction.employee?.user?.imageUrl ?? null
		};
		group.reactors.push(reactor);
		if (myEmployeeId && employeeId === myEmployeeId) {
			group.reactedByMe = true;
			group.reactionId = reaction.id ?? null;
		}
	}

	// A stable sort: within a record, the emojis keep the order they were first used in.
	return [...groups.values()]
		.sort((first, second) => (order.get(first.entityId) ?? 0) - (order.get(second.entityId) ?? 0))
		.map(({ seen: _seen, ...summary }) => summary);
}
