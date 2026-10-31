import { Comment } from './comment.entity';

/** Whether the caller may read a comment found in a read's result. */
export type IsCommentReadable = (comment: Record<string, unknown>) => Promise<boolean>;

/**
 * The relations of an employee and of a team that hold comments: those the record is assigned through the comment's
 * `members` and `teams`.
 */
const COMMENT_COLLECTIONS: ReadonlySet<string> = new Set(['assignedComments']);

/**
 * Removes from a comment read's result the related comments that `isReadable` refuses, and returns the result.
 *
 * The comments a read answers (the items of a page, the elements of a list, or the one comment read) are kept by the
 * read's own rules; this walks what they load beside them. A related comment is one reached through a comment's
 * `parent` or `replies`, or any loaded comment (an employee's `assignedComments`, for one). A refused comment in a
 * list is left out of it, and a refused single relation is set to `null`. Comments it keeps are walked in turn, so a
 * reply's own replies are checked as well. A comment loaded more than once is asked about once.
 *
 * @param result - The read's result, changed in place.
 * @param isReadable - Whether the caller may read a related comment.
 * @returns `result`.
 */
export function withoutUnreadableRelatedComments<R>(result: R, isReadable: IsCommentReadable): Promise<R> {
	return withoutUnreadable(result, isReadable, true);
}

/**
 * Removes from the read of another kind of record (employees, teams) the comments that `isReadable` refuses, and
 * returns the result.
 *
 * The records read are not comments, so none of them is kept as one: every comment loaded beside them is asked about
 * (an employee's or a team's `assignedComments`, and what those load in turn), by the rules of
 * {@link withoutUnreadableRelatedComments}. A `parent` or `replies` of a record that is not a comment stays that
 * record's own.
 *
 * @param result - The read's result, changed in place.
 * @param isReadable - Whether the caller may read a comment.
 * @returns `result`.
 */
export function withoutUnreadableLoadedComments<R>(result: R, isReadable: IsCommentReadable): Promise<R> {
	return withoutUnreadable(result, isReadable, false);
}

/**
 * Walks a read's result and leaves out the comments `isReadable` refuses.
 *
 * @param rootsAreComments - Whether the records read are comments, kept by the read's own rules.
 */
async function withoutUnreadable<R>(result: R, isReadable: IsCommentReadable, rootsAreComments: boolean): Promise<R> {
	const visited = new Set<object>();
	const roots = rootsOf(result);
	// The comments read are kept by the read's own rules, wherever they are found again; any other is asked once.
	const verdicts = new Map<object, Promise<boolean>>(
		rootsAreComments ? roots.map((root) => [root, Promise.resolve(true)]) : []
	);
	const readable = (comment: Record<string, unknown>): Promise<boolean> => {
		if (!verdicts.has(comment)) {
			verdicts.set(comment, isReadable(comment));
		}
		return verdicts.get(comment);
	};

	const visit = async (node: Record<string, unknown>, isComment: boolean): Promise<void> => {
		if (visited.has(node)) {
			return;
		}
		visited.add(node);

		for (const [key, value] of Object.entries(node)) {
			if (Array.isArray(value)) {
				const kept: unknown[] = [];
				for (const element of value) {
					if (isNode(element)) {
						const related = isRelatedComment(element, key, isComment);
						if (related && !(await readable(element))) {
							continue;
						}
						await visit(element, related);
					}
					kept.push(element);
				}
				if (kept.length !== value.length) {
					node[key] = kept;
				}
			} else if (isNode(value)) {
				const related = isRelatedComment(value, key, isComment);
				if (related && !(await readable(value))) {
					node[key] = null;
					continue;
				}
				await visit(value, related);
			}
		}
	};

	for (const root of roots) {
		await visit(root, rootsAreComments);
	}
	return result;
}

/** The records a read answers: the items of a page, the elements of a list, or the one record read. */
function rootsOf(result: unknown): Record<string, unknown>[] {
	if (Array.isArray(result)) {
		return result.filter(isNode);
	}
	if (isNode(result) && Array.isArray(result['items'])) {
		return (result['items'] as unknown[]).filter(isNode);
	}
	return isNode(result) ? [result] : [];
}

/**
 * Whether `node`, found under `key` of an object, is a related comment: a loaded `Comment`, an element of a relation
 * that holds comments (also once the result is a plain object), or the `parent` or a reply of a comment.
 */
function isRelatedComment(node: object, key: string, underComment: boolean): boolean {
	return (
		node instanceof Comment ||
		COMMENT_COLLECTIONS.has(key) ||
		(underComment && (key === 'parent' || key === 'replies'))
	);
}

/** Whether `value` is a loaded record to walk, rather than a value. */
function isNode(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value);
}
