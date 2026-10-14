/**
 * The readers of `migration-duplicate-column-check.mjs`, held to every statement shape they must read.
 *
 * A reader that silently skips a shape is a gate that stops measuring without going red: the first version stopped
 * reading a `CREATE TABLE` at its first newline, so a column declared on a later line was never recorded and adding
 * it again passed (Greptile, #10587).
 *
 * Run from the repository root: `node --test tools/scripts/migration-duplicate-column-check.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balancedBody, declaredColumns, findDuplicateColumnAdds } from './migration-duplicate-column-check.mjs';

/** A migration with one dialect branch, as the repository's migrations write one. */
const migration = (branch, name = 'mysqlUpQueryRunner') => `
export class Example1791000000999 implements MigrationInterface {
	public async ${name}(queryRunner: QueryRunner): Promise<any> {
${branch}
	}

	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(\`ALTER TABLE "price_list" ADD COLUMN "elsewhere" varchar\`);
	}
}`;

const found = (source) => findDuplicateColumnAdds(source).map(({ table, column }) => `${table}.${column}`);

test('the single-line MySQL shape that shipped: a generated column declared, then added again', () => {
	const source = migration(`
		await queryRunner.query(
			\`CREATE TABLE \\\`price_list\\\` (\\\`id\\\` varchar(36) NOT NULL, \\\`deletedKey\\\` varchar(36) GENERATED ALWAYS AS (IF(\\\`deletedAt\\\` IS NULL, '0', \\\`id\\\`)) STORED, PRIMARY KEY (\\\`id\\\`)) ENGINE=InnoDB\`
		);
		await queryRunner.query(
			\`ALTER TABLE \\\`price_list\\\` ADD COLUMN \\\`deletedKey\\\` varchar(36) GENERATED ALWAYS AS (IF(\\\`deletedAt\\\` IS NULL, '0', \\\`id\\\`)) STORED\`
		);`);

	assert.deepEqual(found(source), ['price_list.deletedKey']);
});

test('a CREATE TABLE that spans several lines is read to its closing parenthesis', () => {
	const source = migration(
		`
		await queryRunner.query(\`
			CREATE TABLE "widget" (
				"id" uuid NOT NULL,
				"name" character varying NOT NULL,
				"note" text,
				CONSTRAINT "PK_widget" PRIMARY KEY ("id")
			)
		\`);
		await queryRunner.query(\`ALTER TABLE "widget" ADD "note" text\`);`,
		'postgresUpQueryRunner'
	);

	assert.deepEqual(found(source), ['widget.note']);
});

test('a column the CREATE TABLE did not declare, a constraint, and another branch are not duplicates', () => {
	const source = migration(`
		await queryRunner.query(\`CREATE TABLE "price_list" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL)\`);
		await queryRunner.query(\`ALTER TABLE "price_list" ADD COLUMN "code" varchar\`);
		await queryRunner.query(\`ALTER TABLE "price_list" ADD CONSTRAINT "FK_x" FOREIGN KEY ("name") REFERENCES "y"("id")\`);`);

	// \`elsewhere\` is added by the SQLite branch, which never created the table, and \`name\` only by a constraint.
	assert.deepEqual(found(source), []);
});

test('quoted text, nested parentheses and commas inside a definition do not end or split it', () => {
	const body = balancedBody(
		`CREATE TABLE "t" ("a" varchar DEFAULT 'x, (y', "b" decimal(20,6) CHECK ("b" > (0)), "c" text) ENGINE=InnoDB`,
		`CREATE TABLE "t" `.length
	);

	assert.deepEqual(declaredColumns(body), ['a', 'b', 'c']);
});

test('constraint and index members of a CREATE TABLE are not columns', () => {
	assert.deepEqual(
		declaredColumns(
			'"id" varchar NOT NULL, INDEX "IDX_a" ("id"), UNIQUE KEY "UQ" ("id"), CONSTRAINT "PK" PRIMARY KEY ("id"), CHECK ("id" <> \'\')'
		),
		['id']
	);
});

test('an ADD after a CREATE TABLE that interpolates its members is reported as unverifiable, not passed', () => {
	// The promotion set's shape: the inherited base columns arrive through a fragment the reader cannot see.
	const source = migration(
		[
			'		const i = this.inheritedPostgres;',
			'		await queryRunner.query(`CREATE TABLE "promotion" (${i}, "code" character varying(64), "title" character varying(255) NOT NULL)`);',
			'		await queryRunner.query(`ALTER TABLE "promotion" ADD "id" uuid`);',
			'		await queryRunner.query(`ALTER TABLE "promotion" ADD "title" character varying(255)`);'
		].join('\n'),
		'postgresUpQueryRunner'
	);

	assert.deepEqual(findDuplicateColumnAdds(source), [
		{ method: 'postgresUpQueryRunner', table: 'promotion', column: 'id', unverifiable: true },
		{ method: 'postgresUpQueryRunner', table: 'promotion', column: 'title' }
	]);
});
