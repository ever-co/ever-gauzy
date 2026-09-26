import { GraphQLError, Kind, ValueNode } from 'graphql';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { assertDecimalString } from '../../money/decimal';
import { DecimalScalar } from './decimal.scalar';

const literal = (kind: ValueNode['kind'], value: string): ValueNode => ({ kind, value }) as ValueNode;

/** The error a call throws, for asserting its envelope. */
const thrown = (call: () => unknown): GraphQLError | undefined => {
	try {
		call();
	} catch (error) {
		return error as GraphQLError;
	}

	return undefined;
};

describe('DecimalScalar', () => {
	const scalar = new DecimalScalar();

	describe('output', () => {
		it('serves the number a column transformer produced as the documented string', () => {
			// `ColumnNumericTransformerPipe.from` hands a resolver a `number`, and an unimplemented scalar
			// put it on the wire as a JSON float.
			expect(scalar.serialize(20.01)).toBe('20.010000');
			expect(scalar.serialize(19.99)).toBe('19.990000');
			expect(scalar.serialize(0)).toBe('0.000000');
			expect(scalar.serialize(-0)).toBe('0.000000');
			expect(scalar.serialize(-3)).toBe('-3.000000');
			expect(scalar.serialize(2)).toBe('2.000000');
		});

		it('serves a column’s own text with every significant digit it has, padded to six', () => {
			// What Postgres and MySQL return for numeric(20,6), numeric(12,4) and numeric(20,10) columns.
			expect(scalar.serialize('20.010000')).toBe('20.010000');
			expect(scalar.serialize('20.0100')).toBe('20.010000');
			expect(scalar.serialize('20.01')).toBe('20.010000');
			expect(scalar.serialize('1.2345678900')).toBe('1.23456789');
			expect(scalar.serialize('0.453592370000')).toBe('0.45359237');
			expect(scalar.serialize(' 7 ')).toBe('7.000000');
			expect(scalar.serialize('-0.5')).toBe('-0.500000');
			expect(scalar.serialize('+4.25')).toBe('4.250000');
			expect(scalar.serialize(12n)).toBe('12.000000');
		});

		it('serves one text for one value, whichever dialect and ORM read it', () => {
			// Postgres and MySQL hand a resolver the column's text, SQLite a number, and MikroORM over
			// SQLite `String()` of that number. A client comparing two reads must not see three forms.
			const reads: Array<[unknown, unknown, unknown]> = [
				['20.010000', 20.01, '20.01'],
				['1.2345678900', 1.23456789, '1.23456789'],
				['0.000000', 0, '0'],
				['-12.500000', -12.5, '-12.5']
			];

			for (const [text, number, mikroOrmText] of reads) {
				expect(scalar.serialize(number)).toBe(scalar.serialize(text));
				expect(scalar.serialize(mikroOrmText)).toBe(scalar.serialize(text));
			}
		});

		it('rounds away the binary noise of a stored double instead of failing the response', () => {
			// A SQLite REAL written from JS arithmetic reads back with the noise in it; a scalar that
			// refused it would fail every non-null field that selected it.
			expect(scalar.serialize(0.1 + 0.2)).toBe('0.300000');
			expect(scalar.serialize(1.1 + 2.2)).toBe('3.300000');
			expect(scalar.serialize(10000.1 + 20000.2)).toBe('30000.300000');
			expect(scalar.serialize(-(0.1 + 0.2))).toBe('-0.300000');
		});

		it('rounds away the same noise when the ORM wrote the double out as text', () => {
			// MikroORM's `DecimalType` gives a `string` property `String(value)` of what SQLite returned. No
			// column's text has more than twelve fractional digits, so a text that does is that double.
			expect(scalar.serialize(String(0.1 + 0.2))).toBe('0.300000');
			expect(scalar.serialize('0.30000000000000004')).toBe('0.300000');
			expect(scalar.serialize('60.03000000000001')).toBe('60.030000');
			expect(scalar.serialize('-0.30000000000000004')).toBe('-0.300000');
		});

		it('never rounds a real digit away', () => {
			// A rate read through a transformer from a numeric(20,10) column, and a money value whose
			// sixth decimal a double still holds exactly.
			expect(scalar.serialize(1.2345678901)).toBe('1.2345678901');
			expect(scalar.serialize(1234567890.123456)).toBe('1234567890.123456');
			expect(scalar.serialize(0.000001)).toBe('0.000001');
		});

		it('writes a number that prints with an exponent in plain notation', () => {
			expect(scalar.serialize(1e-7)).toBe('0.0000001');
			expect(scalar.serialize(1e21)).toBe('1000000000000000000000.000000');
			// SQLite's own text for a REAL: the same double as the number, so the same text.
			expect(scalar.serialize('1.0e-07')).toBe('0.0000001');
			expect(scalar.serialize('1e-7')).toBe(scalar.serialize(1e-7));
		});

		it('rounds beyond the working scale, so every value served is one the scalar accepts back', () => {
			expect(scalar.serialize('0.1234567890125')).toBe('0.123456789013');
			expect(scalar.serialize(5e-324)).toBe('0.000000');
		});

		it('never throws for a finite number, whatever arithmetic produced it', () => {
			let seed = 42;
			const random = () => {
				seed = (seed * 16807) % 2147483647;
				return seed / 2147483647;
			};

			for (let index = 0; index < 2000; index++) {
				const value = (random() - 0.5) * 10 ** Math.floor(random() * 30 - 12) + random() * random();
				const served = scalar.serialize(value);

				expect(served).toMatch(/^-?\d+\.\d{6,12}$/);
				// Numerically the value it was, to the precision a double has.
				expect(Math.abs(Number(served) - value)).toBeLessThanOrEqual(Math.abs(value) * 1e-14 + 5e-13);
			}
		});

		it('round-trips a served value through the input rule unchanged', () => {
			for (const amount of ['0', '0.01', '-12.5', '99999999999999.999999', '1.000001', '0.123456789012']) {
				const served = scalar.serialize(amount);

				expect(scalar.parseValue(served)).toBe(served);
				expect(scalar.serialize(scalar.parseValue(served))).toBe(served);
			}
		});

		it('reports a stored value that is no decimal at all as the server’s defect', () => {
			for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 'abc', 'NaN', '', {}, true, ['1']]) {
				const error = thrown(() => scalar.serialize(value));

				expect(error).toBeInstanceOf(GraphQLError);
				expect(error?.extensions.code).toBe(ApiErrorCode.INTERNAL_ERROR);
				expect(error?.extensions.status).toBe(500);
			}
		});

		it('leaves a null column null', () => {
			expect(scalar.serialize(null)).toBeNull();
			expect(scalar.serialize(undefined)).toBeUndefined();
		});
	});

	describe('input', () => {
		it('hands a resolver the value in the JSON type the caller sent it in', () => {
			// The services behind the Decimal inputs were written against what an unimplemented scalar
			// handed them; the scalar refuses what they cannot use rather than changing what they get.
			expect(scalar.parseValue('19.99')).toBe('19.99');
			expect(scalar.parseValue(' 19.99 ')).toBe('19.99');
			expect(scalar.parseValue(19.99)).toBe(19.99);
			expect(scalar.parseValue(-4)).toBe(-4);
		});

		it('checks a literal’s digits as the caller wrote them', () => {
			expect(scalar.parseLiteral(literal(Kind.STRING, '19.99'))).toBe('19.99');
			expect(scalar.parseLiteral(literal(Kind.FLOAT, '19.99'))).toBe(19.99);
			expect(scalar.parseLiteral(literal(Kind.INT, '20'))).toBe(20);
			expect(() => scalar.parseLiteral(literal(Kind.FLOAT, '0.1234567890123'))).toThrow(GraphQLError);
			expect(() => scalar.parseLiteral(literal(Kind.FLOAT, '1e5'))).toThrow(GraphQLError);
		});

		it('refuses the literal kinds an unimplemented scalar waved through', () => {
			// `valueFromASTUntyped` accepted every one of these, so `unitPrice: true` reached the cart
			// service.
			const kinds: Array<Kind.BOOLEAN | Kind.LIST | Kind.OBJECT | Kind.ENUM> = [
				Kind.BOOLEAN,
				Kind.LIST,
				Kind.OBJECT,
				Kind.ENUM
			];

			for (const kind of kinds) {
				const node = literal(kind, 'x');
				const error = thrown(() => scalar.parseLiteral(node));

				expect(error).toBeInstanceOf(GraphQLError);
				expect(error?.extensions.code).toBe(ApiErrorCode.VALIDATION_FAILED);
				expect(error?.nodes).toEqual([node]);
			}
		});

		it('refuses a variable that is not a decimal, with the catalogued validation code', () => {
			for (const value of [true, [], {}, null, Number.NaN, Number.POSITIVE_INFINITY, 0.1 + 0.2, 1e21]) {
				const error = thrown(() => scalar.parseValue(value));

				expect(error).toBeInstanceOf(GraphQLError);
				expect(error?.extensions.code).toBe(ApiErrorCode.VALIDATION_FAILED);
				expect(error?.extensions.status).toBe(400);
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
				const kernelAccepts = thrown(() => assertDecimalString(candidate)) === undefined;
				const scalarAccepts = thrown(() => scalar.parseValue(candidate)) === undefined;

				expect([candidate, scalarAccepts]).toEqual([candidate, kernelAccepts]);
			}
		});
	});
});
