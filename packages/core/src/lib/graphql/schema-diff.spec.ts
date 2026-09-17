import {
	classifySchemaDiff,
	compareReleases,
	findEarlyDeprecationRemovals,
	readSchemaDocument,
	validateSchemaSnapshot
} from './schema-diff';

/**
 * The snapshot gate reads the schema as text, so its two jobs are asserted on fixtures rather than
 * on the committed snapshot: a removal must be classified as breaking, and a deprecated element must
 * not be removable before the release its own marker named.
 *
 * The fixtures are canonical `printSchema` documents — one declaration per line, arguments across
 * lines when they carry descriptions — because that is what the committed snapshot is.
 */
const BASE = `
type Query {
  roles: Role!
  role(id: ID!): Role
}

type Role {
  id: ID!
  name: String!
  tenantId: String!
}

input CreateRoleInput {
  name: String!
  tenantId: String!
}

enum RoleStatus {
  ACTIVE
  ARCHIVED
}
`;

/** The same schema with one line replaced, so a test names the change it makes. */
const withLine = (from: string, to: string) => BASE.replace(from, to);

const changeAt = (diff: ReturnType<typeof classifySchemaDiff>, path: string) =>
	diff.changes.find((change) => change.path === path);

describe('readSchemaDocument', () => {
	it('reads the types, fields, arguments and enum values', () => {
		const document = readSchemaDocument(BASE);

		expect([...document.types.keys()]).toEqual(['Query', 'Role', 'CreateRoleInput', 'RoleStatus']);
		expect([...document.types.get('Role').fields.keys()]).toEqual(['id', 'name', 'tenantId']);
		expect(document.types.get('Query').fields.get('role').arguments.map((argument) => argument.name)).toEqual(['id']);
		expect(document.types.get('Query').fields.get('role').arguments[0].required).toBe(true);
		expect(document.types.get('RoleStatus').fields.size).toBe(2);
		expect(document.problems).toEqual([]);
	});

	it('reads an argument list that printSchema split across lines', () => {
		const document = readSchemaDocument(`
type Query {
  things(
    """The page size."""
    first: Int

    """Where to resume."""
    after: String
  ): String
}
`);

		expect(document.types.get('Query').fields.get('things').arguments.map((argument) => argument.name)).toEqual([
			'first',
			'after'
		]);
		expect(document.types.get('Query').fields.get('things').arguments[0].required).toBe(false);
	});

	it('treats an argument with a default as optional', () => {
		const document = readSchemaDocument(`
type Query {
  things(first: Int = 10): String
}
`);

		expect(document.types.get('Query').fields.get('things').arguments[0].required).toBe(false);
	});
});

describe('validateSchemaSnapshot', () => {
	it('accepts a canonical snapshot', () => {
		expect(validateSchemaSnapshot(BASE)).toEqual([]);
	});

	it('refuses an empty document', () => {
		expect(validateSchemaSnapshot('   ')).toEqual(['the schema snapshot is empty.']);
	});

	it('refuses a document with no Query root', () => {
		expect(validateSchemaSnapshot('type Role {\n  id: ID!\n}\n')).toContainEqual(
			expect.stringContaining("no 'Query' type")
		);
	});

	it('refuses a deprecation with no reason', () => {
		const problems = validateSchemaSnapshot(withLine('  name: String!', '  name: String! @deprecated'));

		expect(problems).toContainEqual(expect.stringContaining('deprecated without a reason'));
	});
});

describe('classifySchemaDiff', () => {
	it('reports no change for an unchanged schema', () => {
		const diff = classifySchemaDiff(BASE, BASE);

		expect(diff.changes).toEqual([]);
		expect(diff.kind).toBe('ADDITIVE');
	});

	it('classifies a new type, field and enum value as additive', () => {
		const added = classifySchemaDiff(BASE, BASE.replace('  ACTIVE\n', '  ACTIVE\n  PENDING\n'));

		expect(added.kind).toBe('ADDITIVE');
		expect(changeAt(added, 'RoleStatus.PENDING').kind).toBe('ENUM_VALUE_ADDED');
	});

	it('classifies a removed field as breaking', () => {
		const removed = classifySchemaDiff(withLine('  tenantId: String!\n', ''), BASE);

		expect(removed.kind).toBe('BREAKING');
		expect(changeAt(removed, 'Role.tenantId').kind).toBe('FIELD_REMOVED');
		expect(removed.changes).toHaveLength(1);
	});

	it('classifies a removed type as breaking', () => {
		const removed = classifySchemaDiff(withLine('\nenum RoleStatus {\n  ACTIVE\n  ARCHIVED\n}\n', ''), BASE);

		expect(removed.kind).toBe('BREAKING');
		expect(changeAt(removed, 'RoleStatus').kind).toBe('TYPE_REMOVED');
	});

	it('classifies a changed field type as breaking', () => {
		const changed = classifySchemaDiff(withLine('  name: String!', '  name: Int!'), BASE);

		expect(changed.kind).toBe('BREAKING');
		expect(changeAt(changed, 'Role.name').kind).toBe('FIELD_TYPE_CHANGED');
	});

	it('classifies a tightened nullability as breaking and a relaxed one as additive', () => {
		const tightened = classifySchemaDiff(withLine('  name: String!', '  name: String'), BASE);
		expect(tightened.kind).toBe('BREAKING');
		expect(changeAt(tightened, 'Role.name').kind).toBe('FIELD_NULLABILITY_TIGHTENED');

		const relaxed = classifySchemaDiff(BASE, withLine('  name: String!', '  name: String'));
		expect(relaxed.kind).toBe('ADDITIVE');
		expect(changeAt(relaxed, 'Role.name').kind).toBe('FIELD_NULLABILITY_RELAXED');
	});

	it('classifies a new required argument as breaking and an optional one as additive', () => {
		const required = classifySchemaDiff(BASE, withLine('  roles: Role!', '  roles(first: Int!): Role!'));
		expect(required.kind).toBe('BREAKING');
		expect(changeAt(required, 'Query.roles(first:)').kind).toBe('ARGUMENT_ADDED');

		const optional = classifySchemaDiff(BASE, withLine('  roles: Role!', '  roles(first: Int): Role!'));
		expect(optional.kind).toBe('ADDITIVE');
	});

	it('classifies a new required input field as breaking', () => {
		const required = classifySchemaDiff(BASE, withLine('input CreateRoleInput {\n  name: String!', 'input CreateRoleInput {\n  code: String!\n  name: String!'));

		expect(required.kind).toBe('BREAKING');
		expect(changeAt(required, 'CreateRoleInput.code').kind).toBe('INPUT_FIELD_ADDED');
	});

	it('reports a new deprecation as additive', () => {
		const deprecated = classifySchemaDiff(
			BASE,
			withLine('  name: String!', '  name: String! @deprecated(reason: "Use fullName; removal planned for 9.9.9")')
		);

		expect(deprecated.kind).toBe('ADDITIVE');
		expect(changeAt(deprecated, 'Role.name').kind).toBe('DEPRECATION_ADDED');
	});
});

describe('findEarlyDeprecationRemovals', () => {
	const deprecated = withLine(
		'  name: String!',
		'  name: String!\n  legacyName: String @deprecated(reason: "Use name; removal planned for 9.9.9")'
	);

	it('refuses a removal before the release the marker named', () => {
		const refusals = findEarlyDeprecationRemovals(deprecated, BASE, '0.1.0');

		expect(refusals).toHaveLength(1);
		expect(refusals[0].path).toBe('Role.legacyName');
		expect(refusals[0].deprecation.removalRelease).toBe('9.9.9');
		expect(refusals[0].deprecation.replacement).toBe('Use name');
		expect(refusals[0].refusal).toContain('removal planned for 9.9.9');
	});

	it('allows it once the release has arrived', () => {
		expect(findEarlyDeprecationRemovals(deprecated, BASE, '9.9.9')).toEqual([]);
		expect(findEarlyDeprecationRemovals(deprecated, BASE, '10.0.0')).toEqual([]);
	});

	it('refuses a removal whose deprecation named no release at all', () => {
		const undated = withLine(
			'  name: String!',
			'  name: String!\n  legacyName: String @deprecated(reason: "Use name")'
		);
		const refusals = findEarlyDeprecationRemovals(undated, BASE, '99.0.0');

		expect(refusals).toHaveLength(1);
		expect(refusals[0].refusal).toContain('names no removal release');
	});

	it('does not report a removal that was never deprecated', () => {
		const plain = withLine('  name: String!', '  name: String!\n  legacyName: String');

		expect(findEarlyDeprecationRemovals(plain, BASE, '0.1.0')).toEqual([]);
	});
});

describe('compareReleases', () => {
	it('orders numerically per segment', () => {
		expect(compareReleases('0.1.0', '0.2.0')).toBeLessThan(0);
		expect(compareReleases('0.10.0', '0.9.0')).toBeGreaterThan(0);
		expect(compareReleases('1.0.0', '1.0.0')).toBe(0);
		expect(compareReleases('1.0', '1.0.1')).toBeLessThan(0);
	});
});
