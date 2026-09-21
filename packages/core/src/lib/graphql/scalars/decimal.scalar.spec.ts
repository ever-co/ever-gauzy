import { GraphQLError, Kind, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { assertDecimalString } from '../../money/decimal';
import { DateTimeScalar } from './date-time.scalar';
import { DecimalScalar } from './decimal.scalar';
import { JsonScalar } from './json.scalar';

const literal = (kind: ValueNode['kind'], value: string): ValueNode => ({ kind, value }) as ValueNode;

describe('DecimalScalar', () => {
	const scalar = new DecimalScalar();

	describe('output', () => {
		it('serialises a column value at the documented wire scale', () => {
			expect(scalar.serialize('20.01')).toBe('20.010000');
			expect(scalar.serialize('20.010000')).toBe('20.010000');
			expect(scalar.serialize(0)).toBe('0.000000');
			expect(scalar.serialize('-3')).toBe('-3.000000');
		});

		it('serialises the JavaScript number a column transformer produced, without a binary artefact', () => {
			// This is the defect the scalar exists for: `ColumnNumericTransformerPipe.from` hands the
			// resolver a `number`, and an unimplemented scalar put it on the wire as a JSON float.
			expect(scalar.serialize(20.01)).toBe('20.010000');
			expect(scalar.serialize(0.1 + 0.2)).not.toBe('0.300000');
			expect(scalar.serialize(19.99)).toBe('19.990000');
		});

		it('keeps every digit a value has rather than rounding one away', () => {
			// A rate carries more than six fractional digits. Padding is safe; rounding is a wrong rate.
			expect(scalar.serialize('0.12345678')).toBe('0.12345678');
		});

		it('round-trips a value through the wire and back without changing it', () => {
			for (const amount of ['0', '0.01', '-12.5', '99999999999999.999999', '1.000001']) {
				expect(scalar.parseValue(scalar.serialize(amount))).toBe(scalar.serialize(amount));
			}
		});

		it('reports a server-side value that is not a decimal as the server’s problem', () => {
			expect(() => scalar.serialize({} as never)).toThrow(GraphQLError);

			try {
				scalar.serialize(Number.NaN);
			} catch (error) {
				expect((error as GraphQLError).extensions.code).toBe(ApiErrorCode.INTERNAL_ERROR);
			}
		});

		it('leaves a null column null', () => {
			expect(scalar.serialize(null)).toBeNull();
			expect(scalar.serialize(undefined)).toBeUndefined();
		});
	});

	describe('input', () => {
		it('accepts the string form the schema tells clients to send', () => {
			expect(scalar.parseValue('19.99')).toBe('19.99');
			expect(scalar.parseValue(' 19.99 ')).toBe('19.99');
			expect(scalar.parseValue(-4)).toBe('-4');
		});

		it('reads a literal exactly as the client wrote it', () => {
			expect(scalar.parseLiteral(literal(Kind.STRING, '19.99'))).toBe('19.99');
			expect(scalar.parseLiteral(literal(Kind.FLOAT, '19.99'))).toBe('19.99');
			expect(scalar.parseLiteral(literal(Kind.INT, '20'))).toBe('20');
		});

		it('refuses the literal kinds an unimplemented scalar waved through', () => {
			// `valueFromASTUntyped` accepted every one of these, so `unitPrice: true` reached the cart
			// service and `Number(true)` priced the line at 1.
			for (const kind of [Kind.BOOLEAN, Kind.LIST, Kind.OBJECT, Kind.NULL, Kind.ENUM]) {
				expect(() => scalar.parseLiteral(literal(kind, 'x'))).toThrow(GraphQLError);
			}
		});

		it('refuses a variable that is not a decimal, with the catalogued validation code', () => {
			for (const value of [true, [], {}, null, Number.NaN, Number.POSITIVE_INFINITY]) {
				expect(() => scalar.parseValue(value as never)).toThrow(GraphQLError);
			}

			try {
				scalar.parseValue(true as never);
			} catch (error) {
				expect((error as GraphQLError).extensions.code).toBe(ApiErrorCode.VALIDATION_FAILED);
				expect((error as GraphQLError).extensions.status).toBe(400);
			}
		});

		it('refuses exactly what the money kernel refuses, and accepts exactly what it accepts', () => {
			const candidates = [
				'0',
				'1.5',
				'-1.5',
				'99999999999999.999999',
				'1e-7',
				'1.0000000000000',
				'999999999999999',
				'+1.00',
				'',
				'12.',
				'.5',
				'abc'
			];

			for (const candidate of candidates) {
				let kernelAccepts = true;

				try {
					assertDecimalString(candidate);
				} catch {
					kernelAccepts = false;
				}

				let scalarAccepts = true;

				try {
					scalar.parseValue(candidate);
				} catch {
					scalarAccepts = false;
				}

				expect([candidate, scalarAccepts]).toEqual([candidate, kernelAccepts]);
			}
		});
	});
});

describe('DateTimeScalar', () => {
	const scalar = new DateTimeScalar();

	it('serialises every instant in the one form the REST surface emits', () => {
		expect(scalar.serialize(new Date(Date.UTC(2026, 8, 21, 10, 15, 30)))).toBe('2026-09-21T10:15:30.000Z');
		expect(scalar.serialize('2026-09-21T12:15:30+02:00')).toBe('2026-09-21T10:15:30.000Z');
		expect(scalar.serialize(Date.UTC(2026, 8, 21, 10, 15, 30))).toBe('2026-09-21T10:15:30.000Z');
	});

	it('reads an RFC 3339 literal and refuses a literal kind that is not one', () => {
		expect(scalar.parseLiteral(literal(Kind.STRING, '2026-09-21T10:15:30Z')).toISOString()).toBe(
			'2026-09-21T10:15:30.000Z'
		);
		expect(() => scalar.parseLiteral(literal(Kind.BOOLEAN, 'true'))).toThrow(GraphQLError);
		expect(() => scalar.parseValue('not a date')).toThrow(GraphQLError);
	});
});

describe('JsonScalar', () => {
	const scalar = new JsonScalar();

	it('carries a document through unchanged', () => {
		const document = { a: 1, b: ['x', { c: true }] };

		expect(scalar.serialize(document)).toBe(document);
		expect(scalar.parseValue(document)).toBe(document);
	});

	it('builds a document from a literal without giving a caller a prototype', () => {
		const built = scalar.parseLiteral({
			kind: Kind.OBJECT,
			fields: [
				{
					kind: Kind.OBJECT_FIELD,
					name: { kind: Kind.NAME, value: '__proto__' },
					value: { kind: Kind.STRING, value: 'polluted' }
				}
			]
		} as unknown as ValueNode) as Record<string, unknown>;

		expect(Object.getPrototypeOf(built)).toBeNull();
		expect(built['__proto__']).toBe('polluted');
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('refuses a literal nested deeper than the bound', () => {
		let node: ValueNode = { kind: Kind.INT, value: '1' } as ValueNode;

		for (let depth = 0; depth < 40; depth++) {
			node = { kind: Kind.LIST, values: [node] } as unknown as ValueNode;
		}

		expect(() => scalar.parseLiteral(node)).toThrow(GraphQLError);
	});
});
