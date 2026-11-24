import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'embed_credential';

/** The client the credential is limited to. */
const CLIENT = 'organizationContactId';

/**
 * The foreign key's and the index's names: TypeORM's own for `embed_credential.organizationContactId`
 * (`DefaultNamingStrategy`), so a schema comparison finds the constraint and the index the entity declares.
 */
export const EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY = 'FK_08e16409458ecc7a09a9fd44e26';
export const EMBED_CREDENTIAL_CLIENT_INDEX = 'IDX_08e16409458ecc7a09a9fd44e2';

/** The column's definition on each database. */
const COLUMN: Record<Dialect, string> = {
	postgres: 'uuid',
	// SQLite cannot add a constraint to an existing table, but a column it adds may carry one inline
	// (its default must then be NULL, which it is).
	sqlite: `varchar CONSTRAINT "${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}" REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
	mysql: 'varchar(255) NULL'
};

/**
 * Adds `embed_credential.organizationContactId` (nullable, indexed, → `organization_contact`, `ON DELETE CASCADE`): the
 * client (an organization contact) a credential is limited to (ever-co/ever-gauzy#12076).
 *
 * Nothing is backfilled and no existing value changes: every credential created before reads as one of the whole
 * organization, as it was. The key cascades on purpose: a contact deleted for good takes the credentials limited to
 * it, which then answer 401 like any unknown credential. Clearing the column instead would turn such a credential into
 * one of the whole organization, and refusing the delete would stop a contact from being deleted at all.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column, index and constraint check elsewhere), and a
 * transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against
 * one database run it one after the other.
 *
 * `down` drops the constraint, the index and the column on Postgres and MySQL. SQLite drops the index and keeps the
 * column, as every additive column of this platform is kept on the embedded dialect: a column that carries a foreign
 * key is dropped there only by rebuilding the table.
 */
export class AddEmbedCredentialOrganizationContact1791000019600 implements MigrationInterface {
	name = 'AddEmbedCredentialOrganizationContact1791000019600';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000019600;

	/**
	 * The MySQL named lock of this migration. MySQL refuses lock names over 64 characters, so the name carries the
	 * timestamp rather than the class name.
	 */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the column missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet, then its index and its foreign key (inline on SQLite). */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const hasColumn = await queryRunner.hasColumn(TABLE, CLIENT);
		if (!hasColumn) {
			let ifNotExists = '';
			if (dialect === 'postgres') {
				ifNotExists = 'IF NOT EXISTS ';
			}
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, CLIENT)} ${COLUMN[dialect]}`
			);
		}

		await this.addIndex(queryRunner, dialect);

		if (dialect === 'sqlite') {
			return;
		}
		if (await this.hasForeignKey(queryRunner)) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TABLE)} ADD CONSTRAINT ${quoted(dialect, EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY)} FOREIGN KEY (${quoted(
				dialect,
				CLIENT
			)}) REFERENCES ${quoted(dialect, 'organization_contact')}(${quoted(dialect, 'id')}) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/** Adds the index on the column. MySQL has no `IF NOT EXISTS` for an index, so the table is asked first. */
	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner)) {
				return;
			}
			await queryRunner.query(
				`CREATE INDEX \`${EMBED_CREDENTIAL_CLIENT_INDEX}\` ON \`${TABLE}\` (\`${CLIENT}\`)`
			);
			return;
		}
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "${EMBED_CREDENTIAL_CLIENT_INDEX}" ON "${TABLE}" ("${CLIENT}")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(
					`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}"`
				);
				await queryRunner.query(`DROP INDEX IF EXISTS "${EMBED_CREDENTIAL_CLIENT_INDEX}"`);
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${CLIENT}"`);
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${EMBED_CREDENTIAL_CLIENT_INDEX}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.mysqlDown(queryRunner));
				break;
		}
	}

	/** Drops the constraint, then the index (which MySQL keeps for a foreign key while one exists), then the column. */
	private async mysqlDown(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasForeignKey(queryRunner)) {
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY}\``
			);
		}
		if (await this.hasIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`${EMBED_CREDENTIAL_CLIENT_INDEX}\` ON \`${TABLE}\``);
		}
		if (await queryRunner.hasColumn(TABLE, CLIENT)) {
			await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${CLIENT}\``);
		}
	}

	/**
	 * Whether the table already carries the foreign key. TypeORM's query runner has no `hasConstraint`, so the
	 * question is asked of the table's own metadata, which keeps a re-run and a revert idempotent.
	 */
	private async hasForeignKey(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(
			table?.foreignKeys?.some((foreignKey) => foreignKey.name === EMBED_CREDENTIAL_CLIENT_FOREIGN_KEY)
		);
	}

	/** Whether the table already carries the index, asked of the table's metadata for the reason above. */
	private async hasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.indices?.some((index) => index.name === EMBED_CREDENTIAL_CLIENT_INDEX));
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				return 'postgres';
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return 'sqlite';
			case DatabaseTypeEnum.mysql:
				return 'mysql';
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its checks and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL migration lock ${lockName}.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}
