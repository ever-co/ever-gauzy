import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, getIntrospectionQuery, getNamedType, isObjectType, parse, specifiedRules, validate } from 'graphql';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { measureOperation } from './graphql-cost';
import { createGraphqlLimitRules } from './graphql-limits';

/**
 * The cost model measures what a document actually selects (SEC-C-01, SEC-C-02).
 *
 * - **Fragments.** A named fragment spread was priced as one field and never expanded, so the depth, alias and
 *   complexity ceilings did not see anything moved into a `fragment`: `query { ...F } fragment F on Query { <30 deep> }`
 *   was accepted while the same body written inline was refused.
 * - **Connections.** A connection was recognised only by a field NAME ending in `Connection`, and no field of the
 *   platform is named that way — so 0 of the connection fields were priced per row of their page, and a
 *   `first: 100` page cost the same as one row.
 */

const SDL = `
	type Query {
		employees(first: Int, page: PageInput): EmployeeConnection!
		employee(id: ID!): Employee
	}
	input PageInput { first: Int last: Int }
	type EmployeeConnection { nodes: [Employee!]! edges: [EmployeeEdge!]! totalCount: Int! pageInfo: PageInfo! }
	type EmployeeEdge { node: Employee! cursor: String! }
	type PageInfo { hasNextPage: Boolean! }
	type Employee { id: ID! name: String manager: Employee tags: [Tag!]! }
	type Tag { id: ID! name: String }
`;
const schema = buildSchema(SDL);

const measure = (source: string) => measureOperation(parse(source) as any, {}, { schema });

/** A chain of `manager` selections `levels` deep under `employee`. */
const chain = (levels: number) => `${'manager { '.repeat(levels)}id${' }'.repeat(levels)}`;

describe('graphql-cost — a fragment is priced as what it selects (SEC-C-01)', () => {
	it('measures the depth of a fragment-wrapped chain as the depth of the same chain written inline', () => {
		const inline = measure(`{ employee(id: "1") { ${chain(20)} } }`);
		const wrapped = measure(`query { ...F } fragment F on Query { employee(id: "1") { ${chain(20)} } }`);

		expect(inline.depth).toBe(22);
		expect(wrapped.depth).toBe(inline.depth);
		expect(wrapped.complexity).toBe(inline.complexity);
	});

	it('counts the aliases inside a fragment', () => {
		const aliased = Array.from({ length: 60 }, (_, index) => `a${index}: employee(id: "${index}") { id }`).join(' ');

		expect(measure(`query { ...F } fragment F on Query { ${aliased} }`).aliases).toBe(60);
	});

	it('prices a fragment once per spread', () => {
		const once = measure(`query { ...F } fragment F on Query { employee(id: "1") { name } }`);
		const twice = measure(`query { ...F a: employee(id: "2") { ...G } } fragment F on Query { employee(id: "1") { name } } fragment G on Employee { name }`);

		expect(twice.complexity).toBeGreaterThan(once.complexity);
		expect(measure(`query { ...F ...F } fragment F on Employee { name }`).fields).toBe(2);
	});

	it('measures a chain of fragments that each spread the next twice in linear time, and prices the blow-up', () => {
		// The failure mode a naive expansion would add: 2^40 walks.
		const levels = 40;
		const fragments = Array.from({ length: levels }, (_, index) =>
			index === levels - 1
				? `fragment F${index} on Employee { name }`
				: `fragment F${index} on Employee { ...F${index + 1} ...F${index + 1} }`
		).join(' ');

		const started = Date.now();
		const measured = measure(`query { employee(id: "1") { ...F0 } } ${fragments}`);

		expect(Date.now() - started).toBeLessThan(1000);
		expect(measured.fields).toBeGreaterThan(2 ** 38);
		expect(measured.complexity).toBeGreaterThan(2 ** 38);
	});

	it('does not hang on a fragment cycle (which the specified rules refuse)', () => {
		const measured = measure(`query { employee(id: "1") { ...A } } fragment A on Employee { name ...B } fragment B on Employee { id ...A }`);

		expect(Number.isFinite(measured.complexity)).toBe(true);
	});

	it('treats an inline fragment as its selections, not as a field', () => {
		const plain = measure(`{ employee(id: "1") { id } }`);
		const inline = measure(`{ employee(id: "1") { ... on Employee { id } } }`);

		expect(inline).toEqual(plain);
	});
});

describe('graphql-cost — a connection is recognised by what it returns (SEC-C-02)', () => {
	it('prices each row of a stated page', () => {
		// connection 10 × 100 + nodes 5 × 100 + two scalars × 100 + one argument
		expect(measure(`{ employees(first: 100) { nodes { id name } } }`).complexity).toBe(1701);
		// Without the schema the field name is all there is, and `employees` is not named for a page.
		expect(measureOperation(parse(`{ employees(first: 100) { nodes { id name } } }`) as any).complexity).toBe(13);
	});

	it('reads the page the protocol states inside `page`', () => {
		expect(measure(`{ employees(page: { first: 100 }) { nodes { id name } } }`).complexity).toBe(1701);
	});

	it('prices the largest page a field states, wherever it states it', () => {
		// The resolver honours `page.first` over `first`; priced the other way round, this cost one row and fetched 100.
		expect(measure(`{ employees(first: 1, page: { first: 100 }) { nodes { id } } }`).complexity).toBe(10 * 100 + 5 * 100 + 1 * 100 + 2);
		expect(measure(`{ employees(first: 100, page: { first: 1 }) { nodes { id } } }`).complexity).toBe(10 * 100 + 5 * 100 + 1 * 100 + 2);
	});

	it('prices a page stated through a variable at the cap', () => {
		expect(measure(`query ($n: Int) { employees(first: $n) { nodes { id name } } }`).complexity).toBe(1701);
		expect(measure(`query ($p: PageInput) { employees(page: $p) { nodes { id name } } }`).complexity).toBe(1701);
	});

	it('prices a connection that states no page at the protocol’s default page', () => {
		// 20 rows: 10 × 20 + 5 × 20 + 2 × 20
		expect(measure(`{ employees { nodes { id name } } }`).complexity).toBe(340);
	});

	it('multiplies nested pages, and does not count the page carrier twice', () => {
		// edges is the carrier of the page the connection already counts; node is one object per edge.
		expect(measure(`{ employees(first: 10) { edges { node { id } } } }`).complexity).toBe(10 * 10 + 5 * 10 + 5 * 10 + 1 * 10 + 1);
	});

	it('prices a list of objects that takes no page at the list fan-out', () => {
		// employee 5 + 1 argument, tags 5 × 10, tag id 1 × 10
		expect(measure(`{ employee(id: "1") { tags { id } } }`).complexity).toBe(66);
	});
});

describe('graphql-limits — the ceilings hold for what a fragment hides (SEC-C-01, SEC-C-02)', () => {
	const rules = createGraphqlLimitRules({ maxDepth: 12, maxComplexity: 5000, maxAliases: 50, introspection: true });
	const refusals = (source: string) =>
		validate(schema, parse(source), [...specifiedRules, ...rules]).map((error) => (error.extensions as any)?.code);

	it('refuses a fragment-wrapped document deeper than the ceiling, as it refuses the inline one', () => {
		expect(refusals(`{ employee(id: "1") { ${chain(20)} } }`)).toContain(ApiErrorCode.GRAPHQL_DEPTH_LIMIT_EXCEEDED);
		expect(refusals(`query { ...F } fragment F on Query { employee(id: "1") { ${chain(20)} } }`)).toContain(
			ApiErrorCode.GRAPHQL_DEPTH_LIMIT_EXCEEDED
		);
	});

	it('refuses fragment-wrapped aliases beyond the ceiling', () => {
		const aliased = Array.from({ length: 60 }, (_, index) => `a${index}: employee(id: "${index}") { id }`).join(' ');

		expect(refusals(`query { ...F } fragment F on Query { ${aliased} }`)).toContain(
			ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED
		);
	});

	it('prices an operation’s root fields together, not the dearest one alone', () => {
		// Each page is 1701 points; five of them in one operation cost five times that.
		const five = Array.from({ length: 5 }, (_, index) => `p${index}: employees(first: 100) { nodes { id name } }`).join(' ');

		expect(measureOperation(parse(`{ ${five} }`).definitions[0] as any, {}, { schema }).complexity).toBe(5 * 1701);
		expect(refusals(`{ ${five} }`)).toContain(ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED);
	});

	it('serves the standard introspection query where introspection is published', () => {
		// The boot gate's contract dump: with fragments expanded, the introspection query's TypeRef fragment priced
		// at depth 15 and cost 11074, and GraphiQL / codegen were refused. Introspection has its own policy rule.
		const introspection = getIntrospectionQuery({ descriptions: true, specifiedByUrl: true, directiveIsRepeatable: true });

		expect(refusals(introspection)).toEqual([]);
	});

	it('still refuses introspection where it is not published', () => {
		const closed = createGraphqlLimitRules({ maxDepth: 12, maxComplexity: 5000, maxAliases: 50, introspection: false });
		const codes = validate(schema, parse(getIntrospectionQuery()), [...specifiedRules, ...closed]).map(
			(error) => (error.extensions as any)?.code
		);

		expect(codes).toContain(ApiErrorCode.GRAPHQL_INTROSPECTION_DISABLED);
	});

	it('refuses nested full pages, and serves an ordinary page', () => {
		expect(refusals(`{ employees(first: 100) { nodes { tags { id name } manager { id } } } }`)).toContain(
			ApiErrorCode.GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED
		);
		expect(refusals(`{ employees(first: 20) { nodes { id name tags { id name } } pageInfo { hasNextPage } } }`)).toEqual([]);
	});
});

describe('graphql-cost — every connection of the composed schema is priced as one (SEC-C-02 inventory)', () => {
	const composed = buildSchema(readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf8'));

	it('recognises every field that returns a connection, at the root and below it', () => {
		const missed: string[] = [];
		let connections = 0;

		for (const type of Object.values(composed.getTypeMap())) {
			if (!isObjectType(type) || type.name.startsWith('__')) continue;

			for (const field of Object.values(type.getFields())) {
				const returned = getNamedType(field.type);
				if (!returned.name.endsWith('Connection') || !isObjectType(returned)) continue;
				connections++;

				// Priced on the type that declares it: a connection is 10 × its page, its one scalar child 1 × the page.
				const fragment = `query { ...F } fragment F on ${type.name} { ${field.name}(first: 100) { __typename } }`;
				const measured = measureOperation(parse(fragment) as any, {}, { schema: composed });
				if (measured.complexity < 1100) missed.push(`${type.name}.${field.name}`);
			}
		}

		expect(connections).toBeGreaterThan(200);
		expect(missed).toEqual([]);
	});
});
