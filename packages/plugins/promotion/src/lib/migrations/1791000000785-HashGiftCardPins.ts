import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { hashGiftCardPin, isGiftCardPinDigest, isKeyedGiftCardPin } from '../gift-card/gift-card-pin';

/**
 * Hashes the gift-card PINs that were stored in plaintext (review R2-G30).
 *
 * ## Why
 *
 * `gift_card.pin` is the card's optional second factor and is meant to hold a digest only: the balance lookup
 * (`GiftCardService.balanceByCode`) hashes the presented PIN with SHA-256 and compares it with the column. Until now
 * `POST /gift-cards` and `PUT /gift-cards/:id` stored the PIN of the body verbatim, so every PIN written over REST sat
 * in the table in plaintext, and the card it protected never verified. The writes now store the digest; this tick
 * turns the rows already written into the form the writes and the check share, so those cards verify with the PIN
 * their holder was given and the plaintext leaves the table.
 *
 * ## What
 *
 * Every row whose `pin` is set and is not already a digest (64 hexadecimal characters) gets the digest of its value,
 * computed here with the same function the service uses (SQLite has no SHA-256 of its own, so the digest is computed
 * once, in the migration, for all three dialects). Each statement is conditional on the value it read, so a row that
 * changed in between is left to the write that changed it. Soft-deleted cards are included: a restored card must
 * verify too. A plaintext PIN that is itself 64 hexadecimal characters cannot be told from a digest and is left as it
 * is; an empty `pin` is no second factor (the check treats it as none) and is left as well, while a PIN of spaces is
 * a PIN (REST accepted it and the check hashes it as stated) and is hashed. The empty string is told apart in
 * JavaScript rather than in SQL, because a MySQL PAD SPACE collation compares `'   '` equal to `''`.
 *
 * ## Down
 *
 * A documented no-op. A digest cannot be turned back into the PIN it came from, and writing plaintext back is what
 * this tick exists to undo; the hashed rows are also exactly what the current code reads, so leaving them in place
 * keeps every card verifiable after a rollback of this tick.
 */
export class HashGiftCardPins1791000000785 implements MigrationInterface {
	name = 'HashGiftCardPins1791000000785';

	/** The table the PINs live in. */
	private static readonly TABLE = 'gift_card';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.hashPins(
			queryRunner,
			(name) => `"${name}"`,
			() => '?'
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * A no-op: see the class documentation.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		this.keepDigests();
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.hashPins(
			queryRunner,
			(name) => `"${name}"`,
			(position) => `$${position}`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * A no-op: see the class documentation.
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		this.keepDigests();
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.hashPins(
			queryRunner,
			(name) => `\`${name}\``,
			() => '?'
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * A no-op: see the class documentation.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		this.keepDigests();
	}

	/**
	 * Replaces every plaintext PIN with its digest, one conditional statement per row.
	 *
	 * @param queryRunner The migration's runner.
	 * @param quote Quotes an identifier for the dialect.
	 * @param parameter The dialect's placeholder for the parameter at a 1-based position.
	 */
	private async hashPins(
		queryRunner: QueryRunner,
		quote: (name: string) => string,
		parameter: (position: number) => string
	): Promise<void> {
		const table = HashGiftCardPins1791000000785.TABLE;

		if (!(await queryRunner.hasTable(table))) {
			console.log(chalk.gray(`${this.name}: no ${table} table, nothing to hash.`));
			return;
		}

		const rows: Array<{ id: string; pin: string | null }> = await queryRunner.query(
			`SELECT ${quote('id')} AS ${quote('id')}, ${quote('pin')} AS ${quote('pin')} FROM ${quote(table)} ` +
				// Only `IS NOT NULL` in SQL: under a MySQL PAD SPACE collation `pin <> ''` is false for a PIN of spaces,
				// which REST accepted and the check hashes as stated; the empty string is skipped below, in JavaScript.
				`WHERE ${quote('pin')} IS NOT NULL`
		);
		let hashed = 0;

		for (const row of rows ?? []) {
			// A keyed `h1:` digest (R2-G30b) is never plaintext: a database whose code wrote one before this tick ran
			// (migrations run late) keeps it rather than having it digested as a PIN.
			if (
				typeof row?.pin !== 'string' ||
				row.pin === '' ||
				isGiftCardPinDigest(row.pin) ||
				isKeyedGiftCardPin(row.pin)
			) {
				continue;
			}

			await queryRunner.query(
				`UPDATE ${quote(table)} SET ${quote('pin')} = ${parameter(1)} ` +
					`WHERE ${quote('id')} = ${parameter(2)} AND ${quote('pin')} = ${parameter(3)}`,
				[hashGiftCardPin(row.pin), row.id, row.pin]
			);
			hashed++;
		}

		console.log(chalk.green(`${this.name}: ${hashed} plaintext gift-card PIN(s) replaced with their digest.`));
	}

	/** The down of every dialect: the digests stay (see the class documentation). */
	private keepDigests(): void {
		console.log(
			chalk.gray(
				`${this.name}: a PIN digest cannot be turned back into the PIN, and plaintext is not written back; ` +
					`the hashed rows are kept (they are what the code reads).`
			)
		);
	}
}
