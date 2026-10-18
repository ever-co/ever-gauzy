import { Scalar, CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { describeKind } from './decimal.scalar';

/**
 * The name the kernel schema declares this scalar under.
 */
export const DATE_TIME_SCALAR_NAME = 'DateTime';

/**
 * An instant, on the wire exactly as the REST surface writes one.
 *
 * `scalar DateTime` was declared in `schema/common.type.gql` — "RFC 3339 with an offset, always UTC,
 * which is the format the REST surface emits" — and implemented nowhere, so graphql-js passed
 * whatever the resolver returned straight through. A `Date` serialised by the JSON encoder happens to
 * produce the right text; a column read back as a string in the driver's own format, a unix
 * millisecond count, or a `Date` inside an object the encoder does not reach do not. On input the
 * unimplemented scalar accepted a boolean, a list and an object without a word.
 *
 * Every instant this scalar emits is `toISOString()` — RFC 3339, milliseconds, `Z` — so two reads of
 * one column over the two protocols are string-identical, which is what a client cache keying on
 * `updatedAt` depends on.
 */
@Scalar(DATE_TIME_SCALAR_NAME)
export class DateTimeScalar implements CustomScalar<string, Date> {
	/** The description graphql-js prints for the scalar. */
	description = 'An instant in RFC 3339 form, always UTC: 2026-09-21T10:15:30.000Z.';

	/**
	 * Reads a value the client sent in a variable.
	 *
	 * @param value The variable's value.
	 * @returns The instant.
	 * @throws GraphQLError `VALIDATION_FAILED` when the value is not an instant.
	 */
	parseValue(value: unknown): Date {
		if (value instanceof Date) {
			return assertInstant(value);
		}

		if (typeof value === 'string') {
			return assertInstant(new Date(value.trim()), value);
		}

		if (typeof value === 'number' && Number.isFinite(value)) {
			// A millisecond count is accepted because clients legitimately hold one; it is read as
			// UTC, which is the only reading this platform has.
			return assertInstant(new Date(value));
		}

		throw refusal(`A ${describeKind(value)} is not an instant. Send it as an RFC 3339 string.`);
	}

	/**
	 * Reads a value the client wrote into the document.
	 *
	 * @param ast The literal node.
	 * @returns The instant.
	 * @throws GraphQLError `VALIDATION_FAILED` for any other literal kind.
	 */
	parseLiteral(ast: ValueNode): Date {
		if (ast.kind === Kind.STRING) {
			return assertInstant(new Date(ast.value.trim()), ast.value);
		}

		if (ast.kind === Kind.INT) {
			return assertInstant(new Date(Number(ast.value)));
		}

		throw refusal(`A ${ast.kind} literal is not an instant. Write it as an RFC 3339 string.`);
	}

	/**
	 * Renders a value the server is about to send.
	 *
	 * @param value The resolved value: a `Date`, the driver's own text, or a millisecond count.
	 * @returns The instant in RFC 3339 form.
	 * @throws GraphQLError `INTERNAL_ERROR` when the server holds something that is not an instant.
	 */
	serialize(value: unknown): string {
		if (value === null || value === undefined) {
			return value as unknown as string;
		}

		const instant =
			value instanceof Date
				? value
				: typeof value === 'string'
					? new Date(value)
					: typeof value === 'number' && Number.isFinite(value)
						? new Date(value)
						: null;

		if (!instant || Number.isNaN(instant.getTime())) {
			throw new GraphQLError(`A ${describeKind(value)} cannot be served as a DateTime.`, {
				extensions: { code: ApiErrorCode.INTERNAL_ERROR, status: 500 }
			});
		}

		return instant.toISOString();
	}
}

/**
 * @param instant The candidate instant.
 * @param source The text it was read from, for the message.
 * @returns The same instant, once it is known to be a real one.
 * @throws GraphQLError `VALIDATION_FAILED` when it is not.
 */
function assertInstant(instant: Date, source?: string): Date {
	if (Number.isNaN(instant.getTime())) {
		throw refusal(`"${source ?? String(instant)}" is not a readable instant. Use RFC 3339: 2026-09-21T10:15:30Z.`);
	}

	return instant;
}

/**
 * @param message What the caller has to fix.
 * @returns The error to throw, carrying the catalogued code the REST surface uses for the same class
 * of mistake.
 */
function refusal(message: string): GraphQLError {
	return new GraphQLError(message, {
		extensions: { code: ApiErrorCode.VALIDATION_FAILED, status: 400 }
	});
}
