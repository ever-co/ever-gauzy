import { Comment } from './comment.entity';

/**
 * Removes from a comment read's result the related comments that `isReadable` refuses, and returns the result.
 *
 * The comments a read answers (the items of a page, the elements of a list, or the one comment read) are kept by the
 * read's own rules; this walks what they load beside them. A related comment is one reached through a comment's
 * `parent` or `replies`, or any loaded `Comment` instance (an employee's `assignedComments`, for one). A refused
 * comment in a list is left out of it, and a refused single relation is set to `null`. Comments it keeps are walked
 * in turn, so a reply's own replies are checked as well. A comment loaded more than once is asked about once.
 *
 * @param result - The read's result, changed in place.
 * @param isReadable - Whether the caller may read a related comment.
 * @returns `result`.
 */
export async function withoutUnreadableRelatedComments<R>(
	result: R,
	isReadable: (comment: Record<string, unknown>) => Promise<boolean>
): Promise<R> {
	const visited = new Set<object>();
	const roots = rootsOf(result);
	// The comments read are kept by the read's own rules, wherever they are found again; any other is asked once.
	const verdicts = new Map<object, Promise<boolean>>(roots.map((root) => [root, Promise.resolve(true)]));
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
		await visit(root, true);
	}
	return result;
}

/** The comments a read answers: the items of a page, the elements of a list, or the one comment read. */
function rootsOf(result: unknown): Record<string, unknown>[] {
	if (Array.isArray(result)) {
		return result.filter(isNode);
	}
	if (isNode(result) && Array.isArray(result['items'])) {
		return (result['items'] as unknown[]).filter(isNode);
	}
	return isNode(result) ? [result] : [];
}

/** Whether `node`, found under `key` of an object, is a related comment. */
function isRelatedComment(node: object, key: string, underComment: boolean): boolean {
	return node instanceof Comment || (underComment && (key === 'parent' || key === 'replies'));
}

/** Whether `value` is a loaded record to walk, rather than a value. */
function isNode(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value);
}
