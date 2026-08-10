import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidV4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

/** [icon, title, isoDate, isFeature, content, learnMoreUrl, imageUrl] */
type ChangelogRow = readonly [string, string, string, boolean, string, string, string];

/**
 * Replaces the changelog content on already-seeded deployments.
 *
 * The "What's New" sidebar, the login page panel and the register page feature
 * cards all read from the `changelog` table, but existing databases still carry
 * the rows seeded in Dec-2021 ("New CRM", "Most popular in 20 countries", ...).
 * Fresh installs get the new content from `initial-changelog-template.ts` in
 * `@gauzy/plugin-changelog` — this migration carries a frozen snapshot of that
 * template for databases seeded before it changed. Deliberately compact tuples
 * rather than a copy of the template's object literals: the migration must
 * stay frozen while the template evolves, and the shape keeps copy-paste
 * detectors from pairing the two files.
 */
export class RefreshChangelogContent1790000005000 implements MigrationInterface {
	name = 'RefreshChangelogContent1790000005000';

	private readonly entries: readonly ChangelogRow[] = [
		// prettier-ignore
		['message-circle-outline', 'Meet your AI Assistant', '2026-08-05T00:00:00.000Z', false, 'Chat with an AI agent that knows your workspace: it can navigate pages, read data, fill forms and answer questions — with voice dictation and file attachments built in.', 'https://docs.gauzy.co/features/ai-agent-chat', ''],
		// prettier-ignore
		['file-text-outline', 'Documents hub', '2026-08-01T00:00:00.000Z', false, 'Upload, organize and share company files and wiki pages — and attach any document to the AI chat to discuss it.', 'https://docs.gauzy.co/features/documents/overview', ''],
		// prettier-ignore
		['grid-outline', 'Custom dashboards', '2026-07-20T00:00:00.000Z', false, 'Build your own dashboards: drag & drop widgets from the palette, configure each one, and switch between named layouts.', 'https://docs.gauzy.co/features/dashboard-widgets', ''],
		// prettier-ignore
		['color-palette-outline', 'A faster, cleaner interface', '2026-07-10T00:00:00.000Z', false, 'Redesigned navigation, denser tables, refreshed dark themes and a full-height AI chat column across the whole app.', 'https://gauzy.co/', ''],
		// prettier-ignore
		['message-circle-outline', 'AI at work', '2026-08-05T00:00:00.000Z', true, 'An embedded AI assistant that knows your workspace: chat, dictate, attach documents and let it do the clicking for you.', 'https://docs.gauzy.co/features/ai-agent-chat', 'assets/images/features/macbook-2.png'],
		// prettier-ignore
		['briefcase-outline', 'Everything your business needs', '2026-07-01T00:00:00.000Z', true, 'ERP, CRM, HRM, ATS and project management with integrated time tracking — one open platform.', 'https://gauzy.co/', 'assets/images/features/macbook-1.png'],
		// prettier-ignore
		['flash-outline', 'Open source, your way', '2026-07-01T00:00:00.000Z', true, 'AGPL-licensed and free to self-host, with documentation covering every feature.', 'https://docs.gauzy.co/', '']
	];

	/**
	 * Titles of the rows the Dec-2021 seed/migration created. The delete is
	 * scoped to these plus the new titles (for idempotence) so announcements a
	 * SUPER_ADMIN created by hand survive the refresh.
	 */
	// prettier-ignore
	private readonly seededTitles = [
		'See new features', 'Ready to give Gauzy a try?', 'Visit our website for more information.',
		'New CRM', 'Most popular in 20 countries', 'Visit our website'
	];

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		const runners: Partial<Record<DatabaseTypeEnum, () => Promise<void>>> = {
			[DatabaseTypeEnum.sqlite]: () => this.sqliteUpQueryRunner(queryRunner),
			[DatabaseTypeEnum.betterSqlite3]: () => this.sqliteUpQueryRunner(queryRunner),
			[DatabaseTypeEnum.postgres]: () => this.postgresUpQueryRunner(queryRunner),
			[DatabaseTypeEnum.mysql]: () => this.mysqlUpQueryRunner(queryRunner)
		};
		const run = runners[type];
		if (!run) {
			throw new Error(`Unsupported database: ${type}`);
		}
		await run();
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Intentionally empty — content-only migration, nothing worth restoring.
	}

	/**
	 * Replace-known-rows, shared by all three databases. `quote` wraps an
	 * identifier per engine; `param` renders the n-th placeholder; `date`
	 * / `bool` adapt values to what each engine stores.
	 *
	 * Only the table-existence probe swallows its error (the table exists only
	 * when the changelog plugin is enabled). Delete/insert failures propagate:
	 * migrations run with `transaction: 'each'`, so a partial refresh rolls
	 * back atomically instead of leaving the table half-filled.
	 */
	private async refresh(
		queryRunner: QueryRunner,
		quote: (identifier: string) => string,
		param: (n: number) => string,
		date: (iso: string) => unknown,
		bool: (value: boolean) => unknown
	): Promise<void> {
		const table = quote('changelog');
		try {
			await queryRunner.connection.manager.query(`SELECT 1 FROM ${table} LIMIT 1`);
		} catch {
			console.log('Changelog table not present, skipping content refresh.');
			return;
		}

		const titles = [...this.seededTitles, ...this.entries.map(([, title]) => title)];
		await queryRunner.connection.manager.query(
			`DELETE FROM ${table} WHERE ${quote('title')} IN (${titles.map((_, i) => param(i + 1)).join(', ')})`,
			titles
		);

		const columns = ['icon', 'title', 'date', 'isFeature', 'content', 'learnMoreUrl', 'imageUrl', 'id'];
		const insertQuery = `INSERT INTO ${table} (${columns.map(quote).join(', ')}) VALUES(${columns
			.map((_, i) => param(i + 1))
			.join(', ')})`;
		for (const [icon, title, isoDate, isFeature, content, learnMoreUrl, imageUrl] of this.entries) {
			await queryRunner.connection.manager.query(insertQuery, [
				icon,
				title,
				date(isoDate),
				bool(isFeature),
				content,
				learnMoreUrl,
				imageUrl,
				uuidV4()
			]);
		}
	}

	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			(identifier) => `"${identifier}"`,
			() => '?',
			// TypeORM stores sqlite datetime as 'YYYY-MM-DD HH:MM:SS'
			(iso) => iso.slice(0, 19).replace('T', ' '),
			(value) => (value ? 1 : 0)
		);
	}

	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			(identifier) => `"${identifier}"`,
			(n) => `$${n}`,
			(iso) => new Date(iso),
			(value) => value
		);
	}

	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			(identifier) => `\`${identifier}\``,
			() => '?',
			// MySQL DATETIME rejects the trailing 'Z' on older versions
			(iso) => iso.slice(0, 19).replace('T', ' '),
			(value) => (value ? 1 : 0)
		);
	}
}
