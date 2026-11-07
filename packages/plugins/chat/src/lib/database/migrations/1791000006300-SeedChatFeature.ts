import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { FeatureEnum } from '@gauzy/contracts';
import { dialectOf, lockMigrations, param, q } from '../migration-helpers';

/** The catalogue row of the Chat feature toggle, as the fresh-install seed writes it. */
export const CHAT_FEATURE_ROW = {
	name: 'Chat',
	code: FeatureEnum.FEATURE_CHAT,
	description: 'Chat between employees: channels, direct and group messages, threads, mentions and task cards',
	image: 'chat.png',
	link: 'pages/chat',
	status: 'info',
	icon: 'message-circle-outline'
} as const;

/**
 * Gives an existing installation the `FEATURE_CHAT` catalogue row.
 *
 * The fresh-install seed writes every catalogue row from the default feature list, but an installation that
 * exists already seeded its catalogue before Chat existed, and the core feature migration seeds its own codes
 * only. Without the row the feature guard reads the toggle as off and Settings → Features shows nothing to switch
 * on. A catalogue row and no toggle row is exactly "off by default": a tenant that wants Chat switches it on.
 *
 * Idempotent on every dialect: the row is inserted only when the code is absent.
 */
export class SeedChatFeature1791000006300 implements MigrationInterface {
	name = 'SeedChatFeature1791000006300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		const c = (name: string) => q(d, name);
		const { name, code, description, image, link, status, icon } = CHAT_FEATURE_ROW;
		const existing: unknown[] = await queryRunner.query(
			`SELECT ${c('id')} FROM ${c('feature')} WHERE ${c('code')} = ${param(d, 1)}`,
			[code]
		);
		if (existing.length) return;
		const columns = ['id', 'name', 'code', 'description', 'image', 'link', 'status', 'icon'].map(c).join(', ');
		const values = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => param(d, n)).join(', ');
		try {
			await queryRunner.query(`INSERT INTO ${c('feature')} (${columns}) VALUES (${values})`, [
				randomUUID(),
				name,
				code,
				description,
				image,
				link,
				status,
				icon
			]);
		} catch (error) {
			// Another process (the API and the worker start together) wrote it between the probe and here.
			const again: unknown[] = await queryRunner.query(
				`SELECT ${c('id')} FROM ${c('feature')} WHERE ${c('code')} = ${param(d, 1)}`,
				[code]
			);
			if (!again.length) throw error;
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		const c = (name: string) => q(d, name);
		await queryRunner.query(
			`DELETE FROM ${c('feature_organization')} WHERE ${c('featureId')} IN (SELECT ${c('id')} FROM ${c('feature')} WHERE ${c('code')} = ${param(d, 1)})`,
			[CHAT_FEATURE_ROW.code]
		);
		await queryRunner.query(`DELETE FROM ${c('feature')} WHERE ${c('code')} = ${param(d, 1)}`, [CHAT_FEATURE_ROW.code]);
	}
}
