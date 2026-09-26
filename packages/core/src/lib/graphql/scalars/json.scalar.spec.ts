import { GraphQLError, Kind, ValueNode, parseValue, valueFromASTUntyped } from 'graphql';
import { JSON_LITERAL_MAX_DEPTH, JsonScalar } from './json.scalar';

describe('JsonScalar', () => {
	const scalar = new JsonScalar();

	it('carries a document through unchanged', () => {
		const document = { a: 1, b: ['x', { c: true }] };

		expect(scalar.serialize(document)).toBe(document);
		expect(scalar.parseValue(document)).toBe(document);
	});

	it('reads a literal the way graphql-js reads an untyped one', () => {
		const node = parseValue('{ a: 1, b: 2.5, c: "x", d: [true, null, ENUM_VALUE], e: { f: $v } }');

		expect(scalar.parseLiteral(node, { v: 'variable' })).toEqual(valueFromASTUntyped(node, { v: 'variable' }));
	});

	it('builds a document from a literal without giving a caller a prototype', () => {
		const built = scalar.parseLiteral(parseValue('{ __proto__: "polluted" }')) as Record<string, unknown>;

		expect(Object.getPrototypeOf(built)).toBeNull();
		expect(built['__proto__']).toBe('polluted');
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('refuses a literal nested deeper than the bound, and accepts one at it', () => {
		const nested = (depth: number): ValueNode => {
			let node: ValueNode = { kind: Kind.INT, value: '1' } as ValueNode;

			for (let level = 0; level < depth; level++) {
				node = { kind: Kind.LIST, values: [node] } as unknown as ValueNode;
			}

			return node;
		};

		expect(() => scalar.parseLiteral(nested(JSON_LITERAL_MAX_DEPTH))).not.toThrow();
		expect(() => scalar.parseLiteral(nested(JSON_LITERAL_MAX_DEPTH + 1))).toThrow(GraphQLError);
	});
});
