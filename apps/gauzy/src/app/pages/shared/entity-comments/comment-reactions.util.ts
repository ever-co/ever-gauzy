import { ID, IReactionSummary, IReactionSummaryReactor, ReactionEntityEnum } from '@gauzy/contracts';

/** The emojis the reaction button offers. */
export const QUICK_REACTIONS: ReadonlyArray<string> = Object.freeze(['👍', '🎉', '❤️', '😄', '👀', '🚀', '✅', '👏']);

/** How many reactors a chip's tooltip names before "and N others". */
export const NAMED_REACTORS = 3;

/** A reaction chip as the comment draws it. */
export interface IReactionChip {
	emoji: string;
	count: number;
	mine: boolean;
	/** Who reacted, for the tooltip and the screen reader. */
	label: string;
}

/** The summaries by comment, in the order the platform answered them (the order emojis were first used). */
export function summariesByComment(summaries: ReadonlyArray<IReactionSummary>): Map<ID, IReactionSummary[]> {
	const byComment = new Map<ID, IReactionSummary[]>();
	for (const summary of summaries ?? []) {
		if (!summary?.entityId || !summary.emoji || summary.count <= 0) continue;
		const list = byComment.get(summary.entityId) ?? [];
		list.push(summary);
		byComment.set(summary.entityId, list);
	}
	return byComment;
}

/**
 * The summaries once the caller toggled `emoji` on a comment, as the platform's toggle leaves them: their reaction is
 * taken back when they had it (the chip goes when nobody else has it), added otherwise (a new chip goes last). The
 * optimistic state while the toggle is sent; the next read confirms it.
 */
export function toggledSummaries(
	summaries: ReadonlyArray<IReactionSummary>,
	commentId: ID,
	emoji: string,
	me: IReactionSummaryReactor
): IReactionSummary[] {
	const next = [...summaries];
	const index = next.findIndex((summary) => summary.entityId === commentId && summary.emoji === emoji);
	if (index < 0) {
		let last = -1;
		next.forEach((summary, at) => {
			if (summary.entityId === commentId) last = at;
		});
		next.splice(last < 0 ? next.length : last + 1, 0, {
			entity: ReactionEntityEnum.Comment,
			entityId: commentId,
			emoji,
			count: 1,
			reactedByMe: true,
			reactionId: null,
			reactors: [me]
		});
		return next;
	}
	const current = next[index];
	const others = (current.reactors ?? []).filter((reactor) => reactor.employeeId !== me.employeeId);
	if (current.reactedByMe) {
		if (current.count <= 1) {
			next.splice(index, 1);
		} else {
			next[index] = { ...current, count: current.count - 1, reactedByMe: false, reactionId: null, reactors: others };
		}
		return next;
	}
	next[index] = { ...current, count: current.count + 1, reactedByMe: true, reactors: [...others, me] };
	return next;
}

/**
 * The people a chip names, in the reader's language: the first {@link NAMED_REACTORS} reactors (the reader as `you`,
 * a nameless one as `someone`), then "N others" for the rest, joined as the locale joins a list.
 */
export function reactorsText(
	summary: Pick<IReactionSummary, 'count' | 'reactors'>,
	words: { meEmployeeId?: ID | null; you: string; someone: string; others: (count: number) => string },
	locale: string
): string {
	const reactors = summary.reactors ?? [];
	const names = reactors.slice(0, NAMED_REACTORS).map((reactor) => {
		if (words.meEmployeeId && reactor.employeeId === words.meEmployeeId) return words.you;
		return reactor.name?.trim() || words.someone;
	});
	const rest = Math.max(Math.max(summary.count, reactors.length) - names.length, 0);
	if (rest > 0) names.push(words.others(rest));
	if (!names.length) return '';
	try {
		return new Intl.ListFormat(locale || 'en', { style: 'long', type: 'conjunction' }).format(names);
	} catch {
		return names.join(', ');
	}
}
