import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { BaseEntityEnum } from '@gauzy/contracts';
import { isSpellingOfRecordType } from '../../comment/parent-access/record-type-spelling';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The record types whose comments a comment-access policy governs, as their policies name them. */
const GOVERNED_TYPES = [BaseEntityEnum.OrganizationContact] as const;

/**
 * Stores every comment of a governed record type under the type's exact spelling (ever-co/ever-gauzy#1114).
 *
 * The comment-access registry treats every spelling a database collation could take for a governed type
 * (`organizationcontact`, `Organization Contact`) as that type, so such a comment follows the contact policy when it
 * is read or changed by id. Reads that name no record leave governed comments out with `entity NOT IN (...)`, which
 * the database compares: with its collation on MySQL, exactly on PostgreSQL and SQLite. A comment stored under
 * another spelling before the policy existed would therefore stay in those reads on PostgreSQL and SQLite. New
 * comments can no longer be stored that way (`POST /comment` and the GraphQL mutation accept only the exact
 * `BaseEntityEnum` values, and an edit keeps a comment's type), so rewriting the stored spellings once makes the
 * exclusion exact on every database.
 *
 * Only the `entity` column of those comments changes, to the spelling that names the same record type. Running it
 * again changes nothing.
 */
export class NormalizeOrganizationContactCommentType1791000003880 implements MigrationInterface {
	name = 'NormalizeOrganizationContactCommentType1791000003880';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		if (
			![
				DatabaseTypeEnum.sqlite,
				DatabaseTypeEnum.betterSqlite3,
				DatabaseTypeEnum.postgres,
				DatabaseTypeEnum.mysql
			].includes(dbType)
		) {
			throw Error(`Unsupported database: ${dbType}`);
		}

		const run = (sql: string, parameters: unknown[] = []) =>
			queryRunner.query(replacePlaceholders(p(sql), dbType), parameters);

		const stored: Array<{ entity: unknown }> = await run(`SELECT DISTINCT "entity" FROM "comment"`);

		for (const type of GOVERNED_TYPES) {
			const spellings = stored
				.map(({ entity }) => entity)
				.filter(
					(entity): entity is string =>
						typeof entity === 'string' && entity !== type && isSpellingOfRecordType(entity, type)
				);
			// MySQL compares with the column's collation, which can find spellings equal that the rule above keeps
			// apart, and `DISTINCT` answers one spelling of each such group. The update by the exact spelling reaches
			// all of them; a row already spelled exactly is left as it is, since its value does not change.
			if (dbType === DatabaseTypeEnum.mysql) {
				spellings.push(type);
			}

			for (const spelling of spellings) {
				await run(`UPDATE "comment" SET "entity" = $1 WHERE "entity" = $2`, [type, spelling]);
			}

			console.log(
				chalk.green(
					`${this.name}: comments stored as ${type} under ${spellings.filter((s) => s !== type).length} other spelling(s) rewritten.`
				)
			);
		}
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op: the spellings it replaced named the same record type, and were not kept.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
