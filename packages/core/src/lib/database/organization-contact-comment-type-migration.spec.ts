import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, PermissionsEnum } from '@gauzy/contracts';
import { CommentParentAccessService } from '../comment/parent-access/comment-parent-access.service';
import { NormalizeOrganizationContactCommentType1791000003880 } from './migrations/1791000003880-NormalizeOrganizationContactCommentType';

/**
 * A comment stored under another spelling of a governed record type follows that type's policy when it is read by id,
 * so it must also be left out of the reads that name no record, whose `NOT IN` the database compares exactly on
 * PostgreSQL and SQLite. The migration stores those comments under the exact spelling, and touches nothing else.
 */
const CONTACT = BaseEntityEnum.OrganizationContact;
const PROJECT = BaseEntityEnum.OrganizationProject;

/** [id, entity]: the stored spellings, and whether the comment-access registry reads each as a contact. */
const COMMENTS: Array<[string, string]> = [
	['c1', CONTACT],
	['c2', 'organizationcontact'],
	['c3', 'Organization Contact'],
	['c4', 'ORGANIZATION-CONTACT'],
	['c5', 'OrganizationContáct'],
	['c6', 'Organization​Contact'],
	['c7', 'OrganızationContact'], // a dotless ı: no spelling of the contact type under the registry's rule
	['c8', PROJECT],
	['c9', 'organizationproject']
];

describe('NormalizeOrganizationContactCommentType1791000003880: governed comments are stored under the exact type', () => {
	let dataSource: DataSource;
	let dbPath: string;

	const run = async () => {
		const queryRunner = dataSource.createQueryRunner();
		await new NormalizeOrganizationContactCommentType1791000003880().up(queryRunner);
		await queryRunner.release();
	};
	const storedTypes = async () =>
		Object.fromEntries(
			(await dataSource.query(`SELECT "id", "entity" FROM "comment" ORDER BY "id"`)).map(
				(row: { id: string; entity: string }) => [row.id, row.entity]
			)
		);

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-comment-type-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "comment" ("id" varchar PRIMARY KEY NOT NULL, "entity" varchar NOT NULL, "entityId" varchar NOT NULL)'
		);
		for (const [id, entity] of COMMENTS) {
			await dataSource.query(`INSERT INTO "comment" ("id", "entity", "entityId") VALUES (?, ?, 'record-1')`, [
				id,
				entity
			]);
		}
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('rewrites exactly the spellings the comment-access registry reads as the contact type', async () => {
		const registry = new CommentParentAccessService();
		registry.register({
			entity: CONTACT,
			readPermissions: [PermissionsEnum.ORG_CONTACT_VIEW],
			writePermissions: [PermissionsEnum.ORG_CONTACT_EDIT],
			findAccessibleParent: async () => null
		});

		await run();

		const after = await storedTypes();
		for (const [id, entity] of COMMENTS) {
			expect([id, after[id]]).toEqual([id, registry.governedTypeOf(entity) ?? entity]);
		}
		expect(after).toEqual({
			c1: CONTACT,
			c2: CONTACT,
			c3: CONTACT,
			c4: CONTACT,
			c5: CONTACT,
			c6: CONTACT,
			c7: 'OrganızationContact',
			c8: PROJECT,
			c9: 'organizationproject'
		});
	});

	it('changes nothing when it runs again', async () => {
		await run();
		const once = await storedTypes();

		await run();

		expect(await storedTypes()).toEqual(once);
	});
});
