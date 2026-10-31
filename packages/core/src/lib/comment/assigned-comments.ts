import { omit } from 'underscore';

/**
 * The relation of an employee and of a team that holds the comments they are assigned: the inverse side of a comment's
 * `members` and `teams`.
 */
export const ASSIGNED_COMMENTS = 'assignedComments';

/** How deep {@link mentionsAssignedComments} looks; a request nested deeper counts as naming the relation. */
const MENTION_DEPTH = 16;

/**
 * `input` without the comments it would assign its employee or team (`assignedComments`). The input is not changed.
 *
 * A comment is assigned through the comment API, where its record's policy decides (a contact's note is assigned to
 * nobody, see `CommentService`). A save of the employee or the team would otherwise link a comment from the other
 * side, past that policy.
 *
 * @param input - An employee's or a team's create or update input.
 * @returns `input` itself when it names no `assignedComments`, and a copy without them otherwise.
 */
export function withoutAssignedComments<T>(input: T): T {
	if (input === null || typeof input !== 'object' || !(ASSIGNED_COMMENTS in input)) {
		return input;
	}
	return omit(input, ASSIGNED_COMMENTS) as T;
}

/**
 * Whether a request's parsed query or body names `assignedComments`, in any key or text, whatever the casing: in
 * `relations` as a list or an object, in `select` or `where`, or inside a JSON `data` parameter. No record loads those
 * comments unless a request names them, so a request that does not is answered untouched.
 *
 * @param value - The request's parsed query or body.
 */
export function mentionsAssignedComments(value: unknown): boolean {
	return mentions(value, 0);
}

/** The relation's name in any casing; tested in place, so a long body string is not copied to compare it. */
const NAMES_ASSIGNED_COMMENTS = new RegExp(ASSIGNED_COMMENTS, 'i');

function mentions(value: unknown, depth: number): boolean {
	if (typeof value === 'string') {
		return NAMES_ASSIGNED_COMMENTS.test(value) || mentionsOnceDecoded(value, depth);
	}
	if (value === null || typeof value !== 'object' || Buffer.isBuffer(value)) {
		return false;
	}
	if (depth >= MENTION_DEPTH) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some((element) => mentions(element, depth + 1));
	}
	return Object.entries(value).some(
		([key, element]) => NAMES_ASSIGNED_COMMENTS.test(key) || mentions(element, depth + 1)
	);
}

/**
 * Whether a JSON text names the relation once decoded, as a `data` parameter is decoded (`ParseJsonPipe`) before the
 * read: a JSON escape (`assignedComments`) spells the name without its letters. A text without a backslash
 * decodes to the same letters the plain test already saw, so only a text with one is decoded; one that is not JSON
 * is refused by that pipe, so it reads nothing.
 */
function mentionsOnceDecoded(text: string, depth: number): boolean {
	if (!text.includes('\\')) {
		return false;
	}
	if (depth >= MENTION_DEPTH) {
		return true;
	}
	let decoded: unknown;
	try {
		decoded = JSON.parse(text);
	} catch {
		return false;
	}
	// A JSON text may itself hold a JSON text: it is judged as it decodes in turn
	return mentions(decoded, depth + 1);
}
