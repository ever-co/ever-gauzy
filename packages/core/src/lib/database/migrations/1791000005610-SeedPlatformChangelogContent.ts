import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { platformChangelogEntryId } from '../platform-changelog-entry-id';
import { WhatsNewLink, whatsNewLinkUrl } from '../whats-new-links';
import { DatabaseTypeEnum } from '@gauzy/config';

/** [platform, icon, title, isoDate, content, learnMore]: the link is named; the deployment says where it points. */
type PlatformChangelogRow = readonly [string, string, string, string, string, WhatsNewLink];

/** How each database inserts a row unless its id is taken. */
type InsertUnlessIdTaken = (table: string, columns: string, values: string) => string;

/**
 * Adds the starter What's New entries of the other Ever products that read the `changelog` table: Ever Teams
 * (whose API shares Gauzy's database) and Ever Platform. Runs after `AddChangelogPlatform`, which
 * gives every row its product.
 *
 * Each entry's learn-more link is named, not spelled out (`whats-new-links.ts`): the deployment's settings say where it
 * points, as only the Ever Platform modules name Ever hosts in this repository, and an install that sets none gets
 * the entry without a link. The addresses are read when this runs, once: a deployment that should link its entries
 * (production: the What's New release checklist) sets `WHATS_NEW_EVER_TEAMS_URL`, `WHATS_NEW_EVER_TEAMS_DOCS_URL` and
 * `WHATS_NEW_EVER_URL` before it first runs; a setting added later reaches no row already written, and an operator
 * then sets the link in Settings > What's New. (Databases this ran on before 2026-11-10, stage and demo, got the same
 * addresses as literals; `RewordPlatformChangelogEntries` brings their wording in step.)
 *
 * Fresh installs get the same entries from `platform-changelog-templates.ts` in `@gauzy/plugin-changelog`; this
 * migration carries a frozen snapshot for databases seeded before it existed, as compact tuples so it stays
 * frozen while the template evolves.
 *
 * Additive only: an entry is inserted when its product has no entry of that title yet, so a rerun, or an entry the
 * operator already wrote by hand, is left alone, and `up` deletes nothing. `down` deletes the entries `up` inserted
 * (by their fixed ids, edits included): once `AddChangelogPlatform`'s `down` drops the product column, they would
 * otherwise read as Gauzy's news.
 */
export class SeedPlatformChangelogContent1791000005610 implements MigrationInterface {
	name = 'SeedPlatformChangelogContent1791000005610';

	/**
	 * The MySQL named lock of this migration. Postgres runs are serialised by the data source's migration lock and
	 * SQLite has one process; on MySQL two API processes booting together would both find an entry missing and add
	 * it twice, so the checks and inserts run as one critical section there.
	 */
	readonly mysqlLockName = 'gauzy:migration:1791000005610';

	private readonly entries: readonly PlatformChangelogRow[] = [
		// prettier-ignore
		['ever-teams', 'gift-outline', "What's new and About", '2026-11-08T00:00:00.000Z', 'Open the gift icon in the header to catch up on Ever Teams updates, and the new About page to see which version of the app and the API you are on.', 'everTeams'],
		// prettier-ignore
		['ever-teams', 'color-palette-outline', 'A lighter, cleaner look', '2026-10-17T00:00:00.000Z', 'A compact header and sidebar, one consistent dark mode and tidier inputs and buttons across the whole app.', 'everTeams'],
		// prettier-ignore
		['ever-teams', 'bar-chart-outline', 'Weekly time report', '2026-10-12T00:00:00.000Z', "Group the Time & Activity report by week to see every member's tracked time day by day in one table.", 'everTeamsDocs'],
		// prettier-ignore
		['ever-teams', 'people-outline', 'See who is online', '2026-10-12T00:00:00.000Z', 'Team cards show teammates as online while they are active in the app, even when they are not tracking time.', ''],
		// prettier-ignore
		['ever-teams', 'clock-outline', "Today's time per task", '2026-10-12T00:00:00.000Z', "A member's card on the team page shows which tasks today's tracked time went to, not just the total.", ''],
		// prettier-ignore
		['ever-teams', 'list-outline', 'Daily plans keep your order', '2026-10-12T00:00:00.000Z', 'Drag the tasks of a daily plan into the order you want to work on them, and the order is kept.', ''],
		// prettier-ignore
		['ever-teams', 'message-square-outline', 'Timesheet rejection reasons', '2026-10-12T00:00:00.000Z', 'When a manager rejects a timesheet, the reason they give is saved and shown to the team member.', ''],
		// prettier-ignore
		['ever-teams', 'log-in-outline', 'Sign in with Ever ID', '2026-10-02T00:00:00.000Z', 'Use one Ever ID account to sign in to Ever Teams and the other Ever apps.', 'ever'],
		// prettier-ignore
		['ever-platform', 'grid-outline', 'One Apps page', '2026-11-06T00:00:00.000Z', 'See the Ever products your organization uses, the apps built with Ever Works and your installs from Ever Apps in one place, and set up or connect each.', 'ever'],
		// prettier-ignore
		['ever-platform', 'people-outline', 'Create your organization', '2026-11-01T00:00:00.000Z', 'Create an organization in Ever Cloud and manage it and its Ever products from one place.', 'ever'],
		// prettier-ignore
		['ever-platform', 'shield-outline', 'Account security', '2026-11-01T00:00:00.000Z', 'Review and manage how you sign in to your Ever account from the Account security page.', 'ever'],
		// prettier-ignore
		['ever-platform', 'credit-card-outline', 'Billing in one place', '2026-11-01T00:00:00.000Z', "See and manage your organization's Ever subscriptions from the Billing page.", 'ever'],
		// prettier-ignore
		['ever-platform', 'log-in-outline', 'One Ever ID for every app', '2026-10-02T00:00:00.000Z', 'Sign in to Ever Teams, Ever Works and the other Ever apps with the same Ever ID account.', 'ever']
	];

	/** The starter entries, for the spec that keeps them in step with the fresh-install template. */
	get rows(): readonly PlatformChangelogRow[] {
		return this.entries;
	}

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return this.seed(
					queryRunner,
					(identifier) => `"${identifier}"`,
					() => '?',
					// TypeORM stores sqlite datetime as 'YYYY-MM-DD HH:MM:SS'
					(iso) => iso.slice(0, 19).replace('T', ' '),
					(value) => (value ? 1 : 0),
					(table, columns, values) => `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${values})`
				);
			case DatabaseTypeEnum.postgres:
				return this.seed(
					queryRunner,
					(identifier) => `"${identifier}"`,
					(n) => `$${n}`,
					(iso) => new Date(iso),
					(value) => value,
					(table, columns, values) =>
						`INSERT INTO ${table} (${columns}) VALUES (${values}) ON CONFLICT ("id") DO NOTHING`
				);
			case DatabaseTypeEnum.mysql:
				return withMysqlNamedLock(queryRunner, this.mysqlLockName, () =>
					this.seed(
						queryRunner,
						(identifier) => `\`${identifier}\``,
						() => '?',
						// MySQL DATETIME rejects the trailing 'Z' on older versions
						(iso) => iso.slice(0, 19).replace('T', ' '),
						(value) => (value ? 1 : 0),
						// Only a taken key is let through: INSERT IGNORE would also swallow data errors.
						(table, columns, values) =>
							`INSERT INTO ${table} (${columns}) VALUES (${values}) ON DUPLICATE KEY UPDATE \`id\` = \`id\``
					)
				);
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Deletes the entries `up` inserted, by their fixed ids, so that `AddChangelogPlatform`'s `down`, which drops
	 * `changelog.platform` next, does not leave them to be read as Gauzy's news. An entry the operator wrote under the
	 * same title has another id and stays; an operator's edits to a seeded entry are lost with it.
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return this.unseed(queryRunner, (identifier) => `"${identifier}"`, () => '?');
			case DatabaseTypeEnum.postgres:
				return this.unseed(queryRunner, (identifier) => `"${identifier}"`, (n) => `$${n}`);
			case DatabaseTypeEnum.mysql:
				return this.unseed(queryRunner, (identifier) => `\`${identifier}\``, () => '?');
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Inserts every entry whose product has no entry of that title yet (an entry the operator wrote by hand under
	 * the same title wins), under its fixed id, skipping an id already taken (a concurrent run). Runs through
	 * `queryRunner.query`, which carries the migration's transaction, so a failed insert rolls the batch back.
	 */
	private async seed(
		queryRunner: QueryRunner,
		quote: (identifier: string) => string,
		param: (n: number) => string,
		date: (iso: string) => unknown,
		bool: (value: boolean) => unknown,
		insertUnlessIdTaken: InsertUnlessIdTaken
	): Promise<void> {
		if (!(await queryRunner.hasTable('changelog')) || !(await queryRunner.hasColumn('changelog', 'platform'))) {
			console.log(chalk.gray(`${this.name}: no changelog.platform column, nothing to seed.`));
			return;
		}
		const table = quote('changelog');
		const existsQuery = `SELECT 1 FROM ${table} WHERE ${quote('platform')} = ${param(1)} AND ${quote(
			'title'
		)} = ${param(2)} LIMIT 1`;
		const columns = ['platform', 'icon', 'title', 'date', 'isFeature', 'content', 'learnMoreUrl', 'imageUrl', 'id'];
		const insertQuery = insertUnlessIdTaken(
			table,
			columns.map(quote).join(', '),
			columns.map((_, i) => param(i + 1)).join(', ')
		);

		let attempted = 0;
		for (const [platform, icon, title, isoDate, content, learnMore] of this.entries) {
			const existing = await queryRunner.query(existsQuery, [platform, title]);
			if (Array.isArray(existing) && existing.length > 0) {
				continue;
			}
			await queryRunner.query(insertQuery, [
				platform,
				icon,
				title,
				date(isoDate),
				bool(false),
				content,
				whatsNewLinkUrl(learnMore),
				'',
				platformChangelogEntryId(platform, title)
			]);
			attempted++;
		}
		console.log(
			chalk.green(`${this.name}: ${attempted} of ${this.entries.length} entries missing, inserted unless taken.`)
		);
	}

	/** Deletes the starter entries by their fixed ids, whether or not `changelog.platform` is still there. */
	private async unseed(
		queryRunner: QueryRunner,
		quote: (identifier: string) => string,
		param: (n: number) => string
	): Promise<void> {
		if (!(await queryRunner.hasTable('changelog'))) {
			return;
		}
		const ids = this.entries.map(([platform, , title]) => platformChangelogEntryId(platform, title));
		await queryRunner.query(
			`DELETE FROM ${quote('changelog')} WHERE ${quote('id')} IN (${ids.map((_, i) => param(i + 1)).join(', ')})`,
			ids
		);
	}
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running this migration at once
 * run its checks and inserts one after the other. The lock is session-level and released in `finally`.
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
