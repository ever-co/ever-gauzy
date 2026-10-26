/**
 * How {@link restatesStoredValue} reads a decimal.
 */
export interface IRestatementOptions {
	/**
	 * Reads a value as a canonical decimal string, or answers `null` when the value is not a decimal. Two values that
	 * both read as decimals are compared by what this answers. The default reads plain decimal text
	 * (`[+-]digits[.digits]`) and drops a leading `+` and the trailing fractional zeros, so `'10'` restates
	 * `'10.000000'` (a decimal column's scale) and `'+1'` restates `'1'`; a module with its own decimal reader (one
	 * that also accepts leading zeros or surrounding blanks) passes it here.
	 */
	decimal?: (value: unknown) => string | null;
}

/**
 * Whether a value a write states is the value a row already holds, so stating it again is not a change.
 *
 * An update that refuses to move a read-only member still accepts a body that merely echoes that member back as it is
 * stored, so a client that sends a whole record back with one writable member edited is not refused for the members
 * it did not touch. This decides "as it is stored":
 *
 * - a missing value (`null` or `undefined`) restates only a missing one;
 * - a date is compared by its instant, because a column reads back as a `Date` while a body states an ISO string;
 * - an object or an array is compared by its content: an object's members in any order (a member holding
 *   `undefined` counts as absent), an array's items in order, a nested date by its instant and any other nested value
 *   strictly; a JSON string on either side is read as the JSON it holds, because a JSON column reads back as text
 *   on some drivers — and so are two strings that both hold an object or an array, whatever their member order or
 *   spacing (text that holds a scalar stays text);
 * - two decimals are compared by value (see {@link IRestatementOptions.decimal});
 * - anything else is compared as text, so an enumeration or an identifier restates its stored value.
 *
 * Before this helper each plugin had its own copy whose last fallback was `String(stated) === String(stored)`, under
 * which any two objects are equal (`'[object Object]'`): a write that CHANGED a read-only object member was taken for
 * a restatement and silently dropped instead of refused. Their decimal reader stripped trailing zeros with
 * `/(\.\d*?)0+$/`, which backtracks polynomially on a long run of digits in a body; the scan below is linear, and the
 * content comparison walks both values with an explicit stack, so a deeply nested body cannot exhaust the call stack.
 *
 * @param stored The value the row holds.
 * @param stated The value the write states.
 * @param options How a decimal is read.
 * @returns True when the stated value is the stored value, so stating it is not a change.
 */
export function restatesStoredValue(stored: unknown, stated: unknown, options: IRestatementOptions = {}): boolean {
	if (isMissing(stored) || isMissing(stated)) {
		return isMissing(stored) && isMissing(stated);
	}

	if (stored instanceof Date || stated instanceof Date) {
		return sameInstant(stored, stated);
	}

	if (typeof stored === 'object' || typeof stated === 'object') {
		return sameContent(asJson(stored), asJson(stated));
	}

	if (typeof stored === 'string' && typeof stated === 'string' && stored !== stated) {
		const held = asJson(stored);
		const wanted = asJson(stated);

		if (isStructured(held) && isStructured(wanted)) {
			return sameContent(held, wanted);
		}
	}

	const decimal = options.decimal ?? canonicalDecimal;
	const held = decimal(stored);
	const wanted = decimal(stated);

	if (held !== null && wanted !== null) {
		return held === wanted;
	}

	return String(stated) === String(stored);
}

/** Plain decimal text: an optional sign, digits, and an optional fraction. Linear: no nested or adjacent quantifiers. */
const DECIMAL_TEXT = /^[+-]?\d+(\.\d+)?$/;

/**
 * The default decimal reader: plain decimal text without a leading `+` and without trailing fractional zeros (and
 * without the point when nothing is left after it), or `null` for anything else. The zeros are dropped by a scan
 * rather than a pattern, so a long run of digits costs linear time.
 */
function canonicalDecimal(value: unknown): string | null {
	if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
		return null;
	}

	const text = String(value);

	if (!DECIMAL_TEXT.test(text)) {
		return null;
	}

	const unsigned = text.startsWith('+') ? text.slice(1) : text;

	if (!unsigned.includes('.')) {
		return unsigned;
	}

	let end = unsigned.length;

	while (unsigned[end - 1] === '0') {
		end--;
	}

	return unsigned.slice(0, unsigned[end - 1] === '.' ? end - 1 : end);
}

/** An object or an array: what JSON text holds when it is a document rather than a scalar. */
function isStructured(value: unknown): value is object {
	return value !== null && typeof value === 'object';
}

function isMissing(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

/** Whether two values name the same instant; a value that is not a date names none. */
function sameInstant(left: unknown, right: unknown): boolean {
	const instant = (value: unknown) =>
		value instanceof Date || typeof value === 'string' || typeof value === 'number'
			? new Date(value).getTime()
			: Number.NaN;
	const held = instant(left);

	return Number.isFinite(held) && held === instant(right);
}

/** A JSON string read as the JSON it holds; anything else, or text that is not JSON, as it is. */
function asJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

/**
 * Whether two values hold the same content: an object's members in any order (a member holding `undefined` is
 * absent), an array's items in order, a date by its instant, anything else strictly. The pairs still to compare are
 * kept on an explicit stack, so the depth of a body costs memory, not call frames.
 */
function sameContent(left: unknown, right: unknown): boolean {
	const pending: Array<[unknown, unknown]> = [[left, right]];

	while (pending.length > 0) {
		const [held, wanted] = pending.pop() as [unknown, unknown];

		if (Array.isArray(held) || Array.isArray(wanted)) {
			if (!Array.isArray(held) || !Array.isArray(wanted) || held.length !== wanted.length) {
				return false;
			}

			held.forEach((item, index) => pending.push([item, wanted[index]]));
			continue;
		}

		if (held instanceof Date || wanted instanceof Date) {
			if (!sameInstant(held, wanted)) {
				return false;
			}
			continue;
		}

		if (held !== null && wanted !== null && typeof held === 'object' && typeof wanted === 'object') {
			const heldMembers = presentMembers(held);
			const wantedMembers = presentMembers(wanted);

			if (
				heldMembers.length !== wantedMembers.length ||
				heldMembers.some((member, index) => member !== wantedMembers[index])
			) {
				return false;
			}

			for (const member of heldMembers) {
				pending.push([(held as Record<string, unknown>)[member], (wanted as Record<string, unknown>)[member]]);
			}
			continue;
		}

		if (held !== wanted) {
			return false;
		}
	}

	return true;
}

/** An object's members that hold a value, sorted, so two objects compare whatever order their members came in. */
function presentMembers(value: object): string[] {
	return Object.keys(value)
		.filter((member) => (value as Record<string, unknown>)[member] !== undefined)
		.sort();
}
