import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { platformChangelogEntryId } from '../platform-changelog-entry-id';

/**
 * Brings the wording of two Ever Platform What's New entries in step on the databases `SeedPlatformChangelogContent`
 * ran on before 2026-11-10 (stage and demo). Their texts named Ever hosts, which only the Ever Platform modules may
 * name in this repository (the egress audit's `static-hostnames` check), and now name the products: "One Apps page"
 * says Ever Apps, "Create your organization" says Ever Cloud. Databases that had not run the seed yet (production, a
 * fresh install) get the new wording from the seed itself, so this changes nothing there.
 *
 * Only an entry nobody edited is reworded: one whose `updatedAt` is still its `createdAt`, since an edit in Settings >
 * What's New moves `updatedAt`, and an operator's own text stays. The learn-more links are left as they are (the
 * addresses seeded there are the ones the deployment's settings hold, `whats-new-links.ts`). `down` restores nothing:
 * the old wording named Ever hosts.
 */
export class RewordPlatformChangelogEntries1791000006900 implements MigrationInterface {
	name = 'RewordPlatformChangelogEntries1791000006900';

	/** [title, content] of the Ever Platform entries reworded, by their title (which keys their fixed id). */
	private readonly entries: ReadonlyArray<readonly [string, string]> = [
		[
			'One Apps page',
			'See the Ever products your organization uses, the apps built with Ever Works and your installs from Ever Apps in one place, and set up or connect each.'
		],
		[
			'Create your organization',
			'Create an organization in Ever Cloud and manage it and its Ever products from one place.'
		]
	];

	/** The reworded entries, for the spec that keeps them in step with the seed. */
	get rows(): ReadonlyArray<readonly [string, string]> {
		return this.entries;
	}

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		if (!(await queryRunner.hasTable('changelog'))) {
			return;
		}
		// Every live table has both (the base entity's columns); a table without them has no edit history to respect.
		if (!(await queryRunner.hasColumn('changelog', 'createdAt')) || !(await queryRunner.hasColumn('changelog', 'updatedAt'))) {
			return;
		}

		let quote: (identifier: string) => string;
		let param: (n: number) => string;
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				quote = (identifier) => `"${identifier}"`;
				param = () => '?';
				break;
			case DatabaseTypeEnum.postgres:
				quote = (identifier) => `"${identifier}"`;
				param = (n) => `$${n}`;
				break;
			case DatabaseTypeEnum.mysql:
				quote = (identifier) => `\`${identifier}\``;
				param = () => '?';
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		for (const [title, content] of this.entries) {
			await queryRunner.query(
				`UPDATE ${quote('changelog')} SET ${quote('content')} = ${param(1)} WHERE ${quote('id')} = ${param(2)} AND ${quote('updatedAt')} = ${quote('createdAt')}`,
				[content, platformChangelogEntryId('ever-platform', title)]
			);
		}
		console.log(chalk.green(`${this.name}: ${this.entries.length} entries reworded where nobody edited them.`));
	}

	public async down(): Promise<void> {
		// Nothing to restore: the old wording named Ever hosts.
	}
}
