import { Scalar, CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import {
	DECIMAL_STRING_PATTERN,
	STORAGE_SCALE,
	formatDecimalUnits,
	isValidDecimalString,
	parseDecimalString,
	pow10
} from '../../money/decimal';

/**
 * The name the kernel schema declares this scalar under.
 */
export const DECIMAL_SCALAR_NAME = 'Decimal';

/**
 * The exact decimal the schema promises, implemented over the platform's own decimal kernel.
 *
 * 🛑 `scalar Decimal` was declared in `schema/common.type.gql` and implemented nowhere. graphql-js
 * gives an unimplemented scalar a pass-through `serialize`, a pass-through `parseValue` and a
 * `parseLiteral` of `valueFromASTUntyped`, which accepts every literal kind there is — so the
 * documented contract held for nothing:
 *
 *   - **Out.** `Order.grandTotal` resolved to whatever the column transformer produced, which is a
 *     JavaScript `number`, so the response carried `"grandTotal": 20.01` — a JSON float — where the
 *     schema documents `"20.010000"`, a string identical to what the REST surface emits for the same
 *     `numeric(20,6)` column. One concept, two protocols, two wire formats.
 *   - **In.** `mutation { addCartLine(input: { unitPrice: true, quantity: [] }) }` passed validation
 *     for `unitPrice: Decimal!` and reached the service, where `Number(true)` is `1`. A client that
 *     sent `19.99` as a float literal had its value parsed as a double before the server saw it.
 *
 * The rules below are the money kernel's own, so a value this scalar accepts is a value
 * `assertDecimalString` accepts and a value it refuses is one the kernel would refuse at the next
 * boundary anyway — which is the point: the refusal happens where the caller can still see which
 * field it was about.
 *
 * **Why the digits are read as text and never as a `number`.** A `FloatValueNode` carries the literal
 * the client *wrote*, as a string, so a literal is read exactly. A variable has already been through
 * `JSON.parse` by the time it arrives, so a `number` variable is a double and only its shortest
 * round-trip form can be recovered; that form is used, and the schema tells clients to send money as
 * a string for exactly this reason. Nothing here ever does arithmetic in binary floating point.
 *
 * **Why `serialize` pads rather than rounds.** The documented wire format is six fractional digits,
 * matching a `numeric(20,6)` column, so a value with fewer is padded and two values that represent
 * the same amount are string-identical. A value with *more* is emitted with the digits it has rather
 * than rounded away: dropping a digit silently is how a rate becomes a wrong rate, and a read must
 * never be the place a value loses precision. A value the kernel cannot read at all is a server-side
 * defect and is reported as one.
 */
@Scalar(DECIMAL_SCALAR_NAME)
export class DecimalScalar implements CustomScalar<string, string> {
	/** The description graphql-js prints for the scalar. */
	description =
		'An exact decimal, serialised as a string with at least six fractional digits — the wire format of a ' +
		'numeric(20,6) column. Never a Float: a binary fraction cannot hold a cent exactly. Send it as a string.';

	/**
	 * Reads a value the client sent in a variable.
	 *
	 * @param value The variable's value, after JSON parsing.
	 * @returns The decimal as canonical text.
	 * @throws GraphQLError `VALIDATION_FAILED` when the value is not an exact decimal.
	 */
	parseValue(value: unknown): string {
		if (typeof value === 'string') {
			return assertDecimal(value.trim());
		}

		if (typeof value === 'number') {
			if (!Number.isFinite(value)) {
				throw refusal(`${String(value)} is not a finite decimal.`);
			}

			// `String(n)` is the shortest text that reads back as the same double, and it is refused
			// below when it is exponential — a value that has to be written as `1e-7` is not a value
			// that should be arriving here as a number at all.
			return assertDecimal(String(value));
		}

		if (typeof value === 'bigint') {
			return assertDecimal(value.toString());
		}

		throw refusal(`A ${describeKind(value)} is not an exact decimal. Send the value as a string.`);
	}

	/**
	 * Reads a value the client wrote into the document.
	 *
	 * Three literal kinds are accepted and every other kind is refused by name. That is the half of
	 * the contract an unimplemented scalar cannot have: `valueFromASTUntyped` accepts a boolean, a
	 * list, an object and an enum without complaint, and each of them reaches the resolver as
	 * something the service will coerce rather than reject.
	 *
	 * @param ast The literal node.
	 * @returns The decimal as canonical text.
	 * @throws GraphQLError `VALIDATION_FAILED` for any other literal kind, or an unreadable value.
	 */
	parseLiteral(ast: ValueNode): string {
		if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
			// An INT and a FLOAT node both carry the digits the client wrote, as text, so a literal is
			// read exactly however it was spelled.
			return assertDecimal(ast.value.trim());
		}

		throw refusal(`A ${ast.kind} literal is not an exact decimal. Write the value as a string.`);
	}

	/**
	 * Renders a value the server is about to send.
	 *
	 * @param value The resolved value: the column's text, or the number a column transformer made of
	 * it, or a bigint.
	 * @returns The decimal at the documented wire scale.
	 * @throws GraphQLError `INTERNAL_ERROR` when the server holds a value that is not a decimal at
	 * all, because that is a defect here rather than a mistake the caller made.
	 */
	serialize(value: unknown): string {
		if (value === null || value === undefined) {
			return value as unknown as string;
		}

		const text =
			typeof value === 'string'
				? value.trim()
				: typeof value === 'number' && Number.isFinite(value)
					? String(value)
					: typeof value === 'bigint'
						? value.toString()
						: null;

		if (text === null) {
			throw new GraphQLError(`A ${describeKind(value)} cannot be served as a Decimal.`, {
				extensions: { code: ApiErrorCode.INTERNAL_ERROR, status: 500 }
			});
		}

		try {
			return atStorageScale(text);
		} catch {
			throw new GraphQLError('The stored value is not an exact decimal.', {
				extensions: { code: ApiErrorCode.INTERNAL_ERROR, status: 500 }
			});
		}
	}
}

/**
 * The value at the documented wire scale: six fractional digits, or more when the value has more.
 *
 * @param text The decimal text.
 * @returns The rendered value.
 */
function atStorageScale(text: string): string {
	const { units, scale } = parseDecimalString(text);

	if (scale >= STORAGE_SCALE) {
		return formatDecimalUnits(units, scale);
	}

	return formatDecimalUnits(units * pow10(STORAGE_SCALE - scale), STORAGE_SCALE);
}

/**
 * Applies the money contract to a value entering the platform.
 *
 * The check is `DECIMAL_STRING_PATTERN` — the kernel's own, which bounds the integer digits at
 * fourteen and the fractional digits at twelve — rather than a looser syntax test, so this surface
 * refuses exactly what `assertDecimalString` refuses at the next boundary. The `+` sign the internal
 * syntax tolerates is not accepted here: a value crossing into the platform is held to the contract,
 * and `+1.00` is not the form any column or any REST payload of this platform uses.
 *
 * @param text The candidate text.
 * @returns The same text, once it is known to be an exact decimal.
 * @throws GraphQLError `VALIDATION_FAILED` when it is not.
 */
function assertDecimal(text: string): string {
	if (!isValidDecimalString(text)) {
		throw refusal(
			`"${text}" is not an exact decimal. It must match ${DECIMAL_STRING_PATTERN.source}: an optional sign, ` +
				'up to fourteen integer digits and up to twelve fractional digits, and never exponential notation.'
		);
	}

	return text;
}

/**
 * The refusal a caller sees, carrying the catalogued code the REST surface uses for the same class of
 * mistake so a client branches on one table rather than two.
 *
 * @param message What the caller has to fix.
 * @returns The error to throw.
 */
function refusal(message: string): GraphQLError {
	return new GraphQLError(message, {
		extensions: { code: ApiErrorCode.VALIDATION_FAILED, status: 400 }
	});
}

/**
 * Names a value's kind for a message, without printing the value itself.
 *
 * @param value The value.
 * @returns The kind, as a caller-facing noun.
 */
export function describeKind(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'list';

	return typeof value;
}
