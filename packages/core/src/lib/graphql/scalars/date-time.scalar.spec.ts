import { GraphQLError, Kind, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { DateTimeScalar } from './date-time.scalar';

const literal = (kind: ValueNode['kind'], value: string): ValueNode => ({ kind, value }) as ValueNode;

describe('DateTimeScalar', () => {
	const scalar = new DateTimeScalar();
	const INSTANT = '2026-09-21T10:15:30.000Z';

	describe('output', () => {
		it('serves a Date exactly as the JSON encoder of the REST surface does', () => {
			const date = new Date(Date.UTC(2026, 8, 21, 10, 15, 30));

			expect(scalar.serialize(date)).toBe(JSON.parse(JSON.stringify(date)));
			expect(scalar.serialize(date)).toBe(INSTANT);
		});

		it('serves a column’s text with no zone as the UTC instant it was stored as', () => {
			// SQLite's own datetime text. Reading it in the server's zone would move it by that offset.
			expect(scalar.serialize('2026-09-21 10:15:30')).toBe(INSTANT);
			expect(scalar.serialize('2026-09-21 10:15:30.000')).toBe(INSTANT);
			expect(scalar.serialize('2026-09-21T10:15:30')).toBe(INSTANT);
		});

		it('serves a text with a zone, a date and a millisecond count as the one RFC 3339 form', () => {
			expect(scalar.serialize('2026-09-21T12:15:30+02:00')).toBe(INSTANT);
			expect(scalar.serialize('2026-09-21T12:15:30+0200')).toBe(INSTANT);
			expect(scalar.serialize('2026-09-21')).toBe('2026-09-21T00:00:00.000Z');
			expect(scalar.serialize(Date.UTC(2026, 8, 21, 10, 15, 30))).toBe(INSTANT);
			expect(scalar.serialize(new Date(INSTANT).toUTCString())).toBe(INSTANT);
		});

		it('reports a stored value that is no instant as the server’s defect', () => {
			for (const value of [new Date(Number.NaN), 'not a date', '1', true, {}, Number.NaN]) {
				let error: GraphQLError | undefined;

				try {
					scalar.serialize(value);
				} catch (thrown) {
					error = thrown as GraphQLError;
				}

				expect(error).toBeInstanceOf(GraphQLError);
				expect(error?.extensions.code).toBe(ApiErrorCode.INTERNAL_ERROR);
			}
		});

		it('leaves a null column null', () => {
			expect(scalar.serialize(null)).toBeNull();
		});
	});

	describe('input', () => {
		it('hands a resolver the value the caller sent, once it is an instant', () => {
			expect(scalar.parseValue('2026-09-21T10:15:30Z')).toBe('2026-09-21T10:15:30Z');
			expect(scalar.parseValue('2026-09-21')).toBe('2026-09-21');
			expect(scalar.parseValue('2026-09-21T12:15:30+02:00')).toBe('2026-09-21T12:15:30+02:00');
			expect(scalar.parseValue(1789985730000)).toBe(1789985730000);
			expect(scalar.parseLiteral(literal(Kind.STRING, '2026-09-21T10:15:30Z'))).toBe('2026-09-21T10:15:30Z');
			expect(scalar.parseLiteral(literal(Kind.INT, '1789985730000'))).toBe(1789985730000);
		});

		it('refuses what is not an instant, with the catalogued validation code', () => {
			for (const value of ['not a date', '1', '2026-02-30', '2026-13-01', '2026-09-21T10:15:30+02', true, {}, [], null]) {
				let error: GraphQLError | undefined;

				try {
					scalar.parseValue(value);
				} catch (thrown) {
					error = thrown as GraphQLError;
				}

				expect([value, error?.extensions.code]).toEqual([value, ApiErrorCode.VALIDATION_FAILED]);
			}
		});

		it('refuses a literal kind that is not an instant', () => {
			expect(() => scalar.parseLiteral(literal(Kind.BOOLEAN, 'true'))).toThrow(GraphQLError);
			expect(() => scalar.parseLiteral(literal(Kind.FLOAT, '1.5'))).toThrow(GraphQLError);
		});
	});
});
