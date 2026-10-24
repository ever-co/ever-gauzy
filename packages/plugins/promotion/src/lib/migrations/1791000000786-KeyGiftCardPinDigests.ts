import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import {
	hashGiftCardPin,
	isGiftCardPinDigest,
	isKeyedGiftCardPin,
	keyGiftCardPinDigest,
	preferredGiftCardPinKeySource
} from '../gift-card/gift-card-pin';

/**
 * Keys the gift-card PIN digests (review R2-G30b).
 *
 * ## Why
 *
 * `HashGiftCardPins1791000000785` left every PIN as `sha256hex(pin)`. A PIN is a few digits, so an unkeyed digest of
 * one is reversed from a database dump by digesting every PIN there is. The stored form is now
 * `h1:<source>:<kid>:<mac>` with `mac = HMAC-SHA256(key, sha256hex(pin))` and a key derived from the server's
 * `ENCRYPTION_KEY` (or a non-default `JWT_SECRET`) - see `gift-card/gift-card-pin.ts`. Because the keyed form is an
 * HMAC **over the legacy digest**, every existing row is converted from what is stored, without the PIN.
 *
 * ## What
 *
 * Every row whose `pin` is a legacy digest gets `keyGiftCardPinDigest(digest)` - the function the service writes
 * with - in one conditional `UPDATE … WHERE id = ? AND pin = ?` per row (a row changed in between is left to the
 * write that changed it). A keyed value is skipped, so the tick is idempotent; an empty `pin` is no second factor and
 * is skipped; any other value (a plaintext PIN that 785 did not reach) is digested as a PIN first, then keyed.
 * Soft-deleted cards are included. The empty string is told apart in JavaScript, not in SQL, because a MySQL PAD
 * SPACE collation compares `'   '` equal to `''`.
 *
 * **With no usable secret configured the tick converts nothing** and says so: there is no key to use, and keying
 * under a value this source could state would protect nothing. The service keeps verifying the legacy digests and
 * keys each one the next time it verifies, once a secret is set; running this tick again is not needed for that.
 * The migration must run with the same `ENCRYPTION_KEY` / `JWT_SECRET` as the API, which is how the platform's
 * migrations run (the API process, or the CLI with the same environment); a digest keyed under another value is
 * reported by the service as keyed under a key it does not have.
 *
 * ## Down
 *
 * A documented no-op, on every dialect, whether or not the key is available: an HMAC cannot be turned back into the
 * digest it was computed over, and the legacy digest is exactly what this tick exists to remove. Rolling the code
 * back below this tick therefore leaves the converted cards unverifiable by the older code until their PIN is set
 * again; the current code verifies both forms.
 */
export class KeyGiftCardPinDigests1791000000786 implements MigrationInterface {
	name = 'KeyGiftCardPinDigests1791000000786';

	/** The table the PINs live in. */
	private static readonly TABLE = 'gift_card';

	/**
	 * @param env The environment the key is derived from; `process.env` unless a suite states one.
	 */
	constructor(private readonly env: Record<string, string | undefined> = process.env) {}

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
		await this.keyDigests(
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
		this.keepKeyed();
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.keyDigests(
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
		this.keepKeyed();
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.keyDigests(
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
		this.keepKeyed();
	}

	/**
	 * Replaces every legacy digest with its keyed form, one conditional statement per row.
	 *
	 * @param queryRunner The migration's runner.
	 * @param quote Quotes an identifier for the dialect.
	 * @param parameter The dialect's placeholder for the parameter at a 1-based position.
	 */
	private async keyDigests(
		queryRunner: QueryRunner,
		quote: (name: string) => string,
		parameter: (position: number) => string
	): Promise<void> {
		const table = KeyGiftCardPinDigests1791000000786.TABLE;

		if (!(await queryRunner.hasTable(table))) {
			console.log(chalk.gray(`${this.name}: no ${table} table, nothing to key.`));
			return;
		}

		if (!preferredGiftCardPinKeySource(this.env)) {
			console.warn(
				chalk.yellow(
					`${this.name}: neither ENCRYPTION_KEY nor a non-default JWT_SECRET is configured, so no gift-card PIN ` +
						`digest was keyed. The service keeps verifying them and keys each on its next successful check once ` +
						`ENCRYPTION_KEY is set.`
				)
			);
			return;
		}

		const rows: Array<{ id: string; pin: string | null }> = await queryRunner.query(
			`SELECT ${quote('id')} AS ${quote('id')}, ${quote('pin')} AS ${quote('pin')} FROM ${quote(table)} ` +
				`WHERE ${quote('pin')} IS NOT NULL`
		);
		let keyed = 0;

		for (const row of rows ?? []) {
			if (typeof row?.pin !== 'string' || row.pin === '' || isKeyedGiftCardPin(row.pin)) {
				continue;
			}

			const digest = isGiftCardPinDigest(row.pin) ? row.pin.toLowerCase() : hashGiftCardPin(row.pin);
			const value = keyGiftCardPinDigest(digest, this.env);

			if (!value) {
				continue;
			}

			await queryRunner.query(
				`UPDATE ${quote(table)} SET ${quote('pin')} = ${parameter(1)} ` +
					`WHERE ${quote('id')} = ${parameter(2)} AND ${quote('pin')} = ${parameter(3)}`,
				[value, row.id, row.pin]
			);
			keyed++;
		}

		console.log(chalk.green(`${this.name}: ${keyed} gift-card PIN digest(s) keyed.`));
	}

	/** The down of every dialect: the keyed digests stay (see the class documentation). */
	private keepKeyed(): void {
		console.log(
			chalk.gray(
				`${this.name}: an HMAC cannot be turned back into the digest it was computed over, and the unkeyed ` +
					`digest is not written back; the keyed PINs are kept (the current code verifies both forms).`
			)
		);
	}
}
