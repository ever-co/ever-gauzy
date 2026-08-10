import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidV4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Replaces the changelog content on already-seeded deployments.
 *
 * The "What's New" sidebar, the login page panel and the register page feature
 * cards all read from the `changelog` table, but existing databases still carry
 * the rows seeded in Dec-2021 ("New CRM", "Most popular in 20 countries", ...).
 * Fresh installs get the new content from `initial-changelog-template.ts` in
 * `@gauzy/plugin-changelog` — this migration mirrors that template for
 * databases that were seeded before it changed. Keep the two in sync.
 *
 * Errors are swallowed per-database like the original SeedChangeLogFeature
 * migration: the table only exists when the changelog plugin is enabled, and a
 * missing table must not fail the whole migration run.
 */
export class RefreshChangelogContent1790000005000 implements MigrationInterface {
	name = 'RefreshChangelogContent1790000005000';

	/** Mirror of INITIAL_CHANGELOG_TEMPLATE (dates as ISO strings, formatted per DB below). */
	private readonly entries = [
		{
			icon: 'message-circle-outline',
			title: 'Meet your AI Assistant',
			date: '2026-08-05T00:00:00.000Z',
			isFeature: false,
			content:
				'Chat with an AI agent that knows your workspace: it can navigate pages, read data, fill forms and answer questions — with voice dictation and file attachments built in.',
			learnMoreUrl: 'https://docs.gauzy.co/features/ai-agent-chat',
			imageUrl: ''
		},
		{
			icon: 'file-text-outline',
			title: 'Documents hub',
			date: '2026-08-01T00:00:00.000Z',
			isFeature: false,
			content:
				'Upload, organize and share company files and wiki pages — and attach any document to the AI chat to discuss it.',
			learnMoreUrl: 'https://docs.gauzy.co/features/documents/overview',
			imageUrl: ''
		},
		{
			icon: 'grid-outline',
			title: 'Custom dashboards',
			date: '2026-07-20T00:00:00.000Z',
			isFeature: false,
			content:
				'Build your own dashboards: drag & drop widgets from the palette, configure each one, and switch between named layouts.',
			learnMoreUrl: 'https://docs.gauzy.co/features/dashboard-widgets',
			imageUrl: ''
		},
		{
			icon: 'color-palette-outline',
			title: 'A faster, cleaner interface',
			date: '2026-07-10T00:00:00.000Z',
			isFeature: false,
			content:
				'Redesigned navigation, denser tables, refreshed dark themes and a full-height AI chat column across the whole app.',
			learnMoreUrl: 'https://gauzy.co/',
			imageUrl: ''
		},
		{
			icon: 'message-circle-outline',
			title: 'AI at work',
			date: '2026-08-05T00:00:00.000Z',
			isFeature: true,
			content:
				'An embedded AI assistant that knows your workspace: chat, dictate, attach documents and let it do the clicking for you.',
			learnMoreUrl: 'https://docs.gauzy.co/features/ai-agent-chat',
			imageUrl: 'assets/images/features/macbook-2.png'
		},
		{
			icon: 'briefcase-outline',
			title: 'Everything your business needs',
			date: '2026-07-01T00:00:00.000Z',
			isFeature: true,
			content: 'ERP, CRM, HRM, ATS and project management with integrated time tracking — one open platform.',
			learnMoreUrl: 'https://gauzy.co/',
			imageUrl: 'assets/images/features/macbook-1.png'
		},
		{
			icon: 'flash-outline',
			title: 'Open source, your way',
			date: '2026-07-01T00:00:00.000Z',
			isFeature: true,
			content: 'AGPL-licensed and free to self-host, with documentation covering every feature.',
			learnMoreUrl: 'https://docs.gauzy.co/',
			imageUrl: ''
		}
	];

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
	 * Content-only migration; the previous content is not worth restoring, so
	 * down is a no-op (matching the original SeedChangeLogFeature migration).
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}

	/**
	 * Delete-then-insert, shared by all three databases. `insertDate` adapts the
	 * ISO date to what each engine stores; `insertBool` adapts the boolean.
	 */
	private async refresh(
		queryRunner: QueryRunner,
		deleteQuery: string,
		buildQuery: (columns: string[]) => string,
		insertDate: (iso: string) => unknown,
		insertBool: (value: boolean) => unknown
	): Promise<void> {
		try {
			// The table holds platform-level seed content only (writes were just
			// locked down to SUPER_ADMIN), so a full replace is safe.
			await queryRunner.connection.manager.query(deleteQuery);

			const columns = ['icon', 'title', 'date', 'isFeature', 'content', 'learnMoreUrl', 'imageUrl', 'id'];
			const insertQuery = buildQuery(columns);
			for (const entry of this.entries) {
				await queryRunner.connection.manager.query(insertQuery, [
					entry.icon,
					entry.title,
					insertDate(entry.date),
					insertBool(entry.isFeature),
					entry.content,
					entry.learnMoreUrl,
					entry.imageUrl,
					uuidV4()
				]);
			}
		} catch (error) {
			// The changelog table only exists when the plugin is enabled — never
			// fail the migration run over optional content.
			console.log('Error while refreshing changelog content, ignoring...', error);
		}
	}

	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			`DELETE FROM "changelog"`,
			(columns) =>
				`INSERT INTO "changelog" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
			// TypeORM stores sqlite datetime as 'YYYY-MM-DD HH:MM:SS'
			(iso) => iso.slice(0, 19).replace('T', ' '),
			(value) => (value ? 1 : 0)
		);
	}

	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			`DELETE FROM "changelog"`,
			(columns) =>
				`INSERT INTO "changelog" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
			(iso) => new Date(iso),
			(value) => value
		);
	}

	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.refresh(
			queryRunner,
			'DELETE FROM `changelog`',
			(columns) =>
				`INSERT INTO \`changelog\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
			// MySQL DATETIME rejects the trailing 'Z' on older versions
			(iso) => iso.slice(0, 19).replace('T', ' '),
			(value) => (value ? 1 : 0)
		);
	}
}
