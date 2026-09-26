import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import {
	DECIMAL_STRING_PATTERN,
	IParsedDecimal,
	STORAGE_SCALE,
	WORKING_SCALE,
	formatDecimalUnits,
	parseDecimalString,
	pow10
} from '../../money/decimal';
import { describeKind, scalarInputRefusal, scalarOutputFailure } from './scalar-errors';

/**
 * The name the kernel schema declares this scalar under.
 */
export const DECIMAL_SCALAR_NAME = 'Decimal';

/**
 * How many significant decimal digits a double carries faithfully (`DBL_DIG`).
 *
 * Any decimal of this many digits survives a trip through a double and back, so a `number` whose
 * shortest form is no longer than this is exactly the decimal it was read from. Digits beyond it are
 * what binary arithmetic left behind — `0.1 + 0.2` is `0.30000000000000004` — and not a value anyone
 * stored.
 */
const DOUBLE_SIGNIFICANT_DIGITS = 15;

/** A decimal written with an exponent: `1e-7`, `1.5E+21`, and SQLite's `1.0e-07`. */
const EXPONENT_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d{1,3})$/;

/** A decimal written plainly, with any number of digits. */
const PLAIN_DECIMAL_PATTERN = /^[+-]?\d+(\.\d+)?$/;

/**
 * The exact decimal the schema promises, over the platform's own decimal kernel.
 *
 * 🛑 `scalar Decimal` was declared in `schema/common.type.gql` and implemented nowhere. graphql-js gives
 * an unimplemented scalar a pass-through `serialize`, a pass-through `parseValue` and a `parseLiteral`
 * of `valueFromASTUntyped`, which accepts every literal kind there is, so the documented contract held
 * for nothing:
 *
 *   - **Out.** `Order.grandTotal` is a `numeric(20,6)` column read through `ColumnNumericTransformerPipe`,
 *     which hands the resolver a JavaScript `number`, so the response carried `"grandTotal": 20.01` — a
 *     JSON float — where the schema documents a string with six fractional digits. A column read
 *     without that transformer carried the driver's own text instead (`"20.010000"` on Postgres and
 *     MySQL, a number again on SQLite), so one type had three wire forms depending on the column and
 *     the dialect.
 *   - **In.** `addCartLine(input: { unitPrice: true, quantity: [] })` passed validation for
 *     `unitPrice: Decimal!` and reached the service.
 *
 * **The form served** is one text per value, whichever dialect and ORM produced it: a string in plain
 * notation with six fractional digits — `"20.010000"`, which is what the schema has always documented
 * and what Postgres and MySQL return for a `numeric(20,6)` column — or up to twelve when the value has
 * more, with no trailing zero past the sixth. The six keep a money column string-identical to its
 * Postgres and MySQL text, and `Number()` of it equals a REST read of a column the transformer serves as
 * a number. Dropping trailing zeroes past the sixth is what lets a `numeric(20,10)` rate read the same
 * from Postgres (`"1.2345678900"`) and from SQLite (`1.23456789`); a real digit is never dropped,
 * because a read must never be where a value loses precision. Beyond the kernel's working scale of
 * twelve a value is rounded, which no column reaches. None of the end-to-end suites compares these
 * fields as text across the two surfaces: `return-receipt-e2e.mjs` reads its `Decimal` counters through
 * `Number()`, and the amount comparison in `commerce-flow-e2e.mjs` is REST against REST.
 *
 * **A stored imprecision never fails a response.** A `number` is a double, and a double from SQLite
 * or from arithmetic can carry binary noise (`0.30000000000000004`). Its digits beyond what a double
 * holds faithfully are rounded away, half away from zero as `numeric` itself rounds, and never below
 * six fractional digits — so a money value's last cent is never touched and the noise never becomes a
 * `GraphQLError` on a non-null field. The same double can also arrive as text, because MikroORM's
 * `DecimalType` hands a `string` property `String(value)` of what SQLite returned; a text no column
 * produces — one with an exponent, or with more fractional digits than any column holds — is treated
 * as the double it is. Only something that is no decimal at all — `NaN`, an object, the text `"abc"` —
 * is reported, as the server's defect.
 *
 * **What a resolver receives** is the value in the JSON type the caller sent it in, once it has passed
 * the kernel's own boundary rule (`DECIMAL_STRING_PATTERN`: up to fourteen integer and twelve
 * fractional digits, no exponent). A string stays a string and a number stays a number: the services
 * behind the several hundred `Decimal` inputs were written against what an unimplemented scalar handed
 * them, and quietly changing the type under them — a `number` that became a string meets a `+` — is a
 * change no spec here can see. What changes is what is refused: a boolean, a list, an object, an enum,
 * a non-finite number and a number or string the kernel would refuse at the next boundary anyway.
 */
@Scalar(DECIMAL_SCALAR_NAME)
export class DecimalScalar implements CustomScalar<string, string | number> {
	/**
	 * The description the SDL declares for the scalar, word for word: the driver copies a scalar class's
	 * description over the SDL's, so a different text here would be a schema the snapshot does not show.
	 */
	description =
		'An exact decimal, served as a string in plain notation with six fractional digits, or up to twelve\n' +
		'when the value has more: "20.010000". Never read it as a Float. Send it as a string; a JSON number is\n' +
		'accepted when it has at most fourteen integer and twelve fractional digits.';

	/**
	 * Reads a value the client sent in a variable.
	 *
	 * @param value The variable's value, after JSON parsing.
	 * @returns The same value, trimmed when it is a string.
	 * @throws GraphQLError `VALIDATION_FAILED` when the value is not an exact decimal.
	 */
	parseValue(value: unknown): string | number {
		if (typeof value === 'string') {
			return assertDecimalInput(value.trim());
		}

		if (typeof value === 'number') {
			if (!Number.isFinite(value)) {
				throw scalarInputRefusal(`A ${describeKind(value)} is not an exact decimal.`);
			}

			// `String(n)` is the shortest text that reads back as the same double. A number that needs
			// an exponent or more digits than the kernel carries is refused: it cannot be the decimal
			// the caller meant, and a string is how the caller says what it meant.
			assertDecimalInput(String(value));

			return value;
		}

		throw scalarInputRefusal(`A ${describeKind(value)} is not an exact decimal. Send the value as a string.`);
	}

	/**
	 * Reads a value the client wrote into the document.
	 *
	 * Three literal kinds are accepted and every other kind is refused. The digits of an `INT` or a
	 * `FLOAT` literal are checked as the client wrote them, before they become a double.
	 *
	 * @param ast The literal node.
	 * @returns A string literal's text, or an `INT`/`FLOAT` literal's number.
	 * @throws GraphQLError `VALIDATION_FAILED` for any other literal kind, or an unreadable value.
	 */
	parseLiteral(ast: ValueNode): string | number {
		if (ast.kind === Kind.STRING) {
			return assertDecimalInput(ast.value.trim(), ast);
		}

		if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
			return Number(assertDecimalInput(ast.value, ast));
		}

		throw scalarInputRefusal(`A ${ast.kind} literal is not an exact decimal. Write the value as a string.`, ast);
	}

	/**
	 * Renders a value the server is about to send.
	 *
	 * @param value The resolved value: a column's text, the number a transformer or a driver made of it,
	 * or a bigint.
	 * @returns The decimal, as a string with six to twelve fractional digits.
	 * @throws GraphQLError `INTERNAL_ERROR` when the server holds something that is not a decimal at all.
	 */
	serialize(value: unknown): string {
		if (value === null || value === undefined) {
			return value as unknown as string;
		}

		if (typeof value === 'number') {
			if (!Number.isFinite(value)) {
				throw scalarOutputFailure(`A ${describeKind(value)} cannot be served as a Decimal.`);
			}

			return atWireScale(withoutBinaryNoise(parseDecimalString(plainNumberText(value))));
		}

		if (typeof value === 'bigint') {
			return atWireScale({ units: value, scale: 0 });
		}

		if (typeof value === 'string') {
			const stored = value.trim();
			const text = plainDecimalText(stored);

			if (text === null) {
				throw scalarOutputFailure('The stored value is not a decimal, so it cannot be served as a Decimal.');
			}

			const parsed = parseDecimalString(text);

			// No column's text has an exponent or more fractional digits than the working scale, so a text
			// that does is a double written out by the ORM, and its noise is rounded away as a number's is.
			return atWireScale(text !== stored || parsed.scale > WORKING_SCALE ? withoutBinaryNoise(parsed) : parsed);
		}

		throw scalarOutputFailure(`A ${describeKind(value)} cannot be served as a Decimal.`);
	}
}

/**
 * Applies the kernel's boundary rule to a value entering the platform.
 *
 * The rule is `DECIMAL_STRING_PATTERN`, so this surface accepts exactly what `assertDecimalString`
 * accepts. The `+` sign the kernel's internal syntax tolerates is not accepted here, because it is not
 * the form any column or any REST payload of this platform uses.
 *
 * @param text The candidate text.
 * @param node The literal it came from, when it came from one.
 * @returns The same text, once it is known to be an exact decimal.
 * @throws GraphQLError `VALIDATION_FAILED` when it is not.
 */
function assertDecimalInput(text: string, node?: ValueNode): string {
	if (!DECIMAL_STRING_PATTERN.test(text)) {
		throw scalarInputRefusal(
			'The value is not an exact decimal: it needs an optional minus sign, up to fourteen integer digits ' +
				'and up to twelve fractional digits, and no exponent. Send it as a string such as "19.99".',
			node
		);
	}

	return text;
}

/**
 * A number's shortest round-trip text, in plain notation.
 *
 * @param value A finite number.
 * @returns Its digits with no exponent.
 */
function plainNumberText(value: number): string {
	const text = String(value);

	return plainDecimalText(text) ?? text;
}

/**
 * A decimal's text in plain notation, or null when the text is no decimal.
 *
 * An exponent is expanded digit by digit rather than through a `number`, so the expansion is exact.
 * The exponent is bounded at three digits, which covers every double, so a stored string cannot ask
 * for a million zeroes.
 *
 * @param text The text, trimmed.
 * @returns The plain text, or null.
 */
function plainDecimalText(text: string): string | null {
	if (PLAIN_DECIMAL_PATTERN.test(text)) {
		return text;
	}

	const exponent = EXPONENT_PATTERN.exec(text);

	if (!exponent || (exponent[2] === '' && (exponent[3] ?? '') === '')) {
		return null;
	}

	const [, sign, integer, fraction = '', power] = exponent;
	const digits = `${integer}${fraction}` || '0';
	const point = integer.length + Number(power);
	const prefix = sign === '-' ? '-' : '';

	if (point <= 0) {
		return `${prefix}0.${'0'.repeat(-point)}${digits}`;
	}

	if (point >= digits.length) {
		return `${prefix}${digits}${'0'.repeat(point - digits.length)}`;
	}

	return `${prefix}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Rounds away the digits a double cannot have carried from a stored decimal.
 *
 * A value is left exactly as it is when its significant digits fit in a double. Otherwise the digits
 * past {@link DOUBLE_SIGNIFICANT_DIGITS} are rounded away — but never below the storage scale, so a
 * value of up to twenty significant digits whose sixth fractional digit is real keeps it.
 *
 * @param parsed The number's digits.
 * @returns The digits without the noise.
 */
function withoutBinaryNoise(parsed: IParsedDecimal): IParsedDecimal {
	const significant = (parsed.units < 0n ? -parsed.units : parsed.units).toString().length;

	if (significant <= DOUBLE_SIGNIFICANT_DIGITS) {
		return parsed;
	}

	return roundToScale(parsed, Math.max(STORAGE_SCALE, parsed.scale - (significant - DOUBLE_SIGNIFICANT_DIGITS)));
}

/**
 * The value as it is served: at most the working scale, and at least the storage scale.
 *
 * A trailing zero past the storage scale is dropped, because it says which column the value came from
 * rather than anything about the value: a `numeric(20,10)` column's text carries four the same value read
 * as a number does not.
 *
 * @param parsed The value.
 * @returns The decimal text.
 */
function atWireScale(parsed: IParsedDecimal): string {
	let { units, scale } = parsed.scale > WORKING_SCALE ? roundToScale(parsed, WORKING_SCALE) : parsed;

	while (scale > STORAGE_SCALE && units % 10n === 0n) {
		units /= 10n;
		scale -= 1;
	}

	if (scale < STORAGE_SCALE) {
		units *= pow10(STORAGE_SCALE - scale);
		scale = STORAGE_SCALE;
	}

	return formatDecimalUnits(units, scale);
}

/**
 * Rounds half away from zero, as a `numeric` column does when it is handed more digits than its scale.
 *
 * @param parsed The value.
 * @param scale The scale to round to; no rounding happens when the value already fits.
 * @returns The rounded value.
 */
function roundToScale(parsed: IParsedDecimal, scale: number): IParsedDecimal {
	if (parsed.scale <= scale) {
		return parsed;
	}

	const drop = pow10(parsed.scale - scale);
	const negative = parsed.units < 0n;
	const magnitude = negative ? -parsed.units : parsed.units;
	let kept = magnitude / drop;

	if ((magnitude % drop) * 2n >= drop) {
		kept += 1n;
	}

	return { units: negative ? -kept : kept, scale };
}
