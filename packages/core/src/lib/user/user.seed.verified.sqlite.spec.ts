import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * ever-co/ever-gauzy#11859: `emailVerifiedAt` and `lastLoginAt` are `insert: false` columns, so the INSERT of a seeded
 * user left them out, and every user of a freshly seeded database, the demo accounts included, read as unverified.
 * Run on a real SQLite database, as the demo seed runs on an empty one.
 */

// The avatar step copies seed images into the public folder; it is not what this spec is about
jest.mock('./user-avatar.seed', () => ({ createSeededUserAvatar: async () => undefined }));

type SeededUser = { email: string; emailVerifiedAt: Date | null; lastLoginAt: Date | null };

type Seeded = {
	users: SeededUser[];
	/** Whether the INSERT of a user may carry each column: an API create must still be unable to set them. */
	insertable: { emailVerifiedAt: boolean; lastLoginAt: boolean };
};

/** Seeds an empty database with the tenant, its roles, the demo admins and the default employee, as the demo does. */
async function seedAnEmptyDatabase(): Promise<Seeded> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-user-seed-${process.pid}-${Date.now()}.sqlite3`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;
	const seeded = {} as Seeded;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { createDefaultTenant } = require('../tenant/tenant.seed');
			const { createRoles } = require('../role/role.seed');
			const { createDefaultAdminUsers, createDefaultEmployeesUsers } = require('./user.seed');
			const { User } = require('./user.entity');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();

			const tenant = await createDefaultTenant(dataSource, 'Ever');
			await createRoles(dataSource, [tenant]);
			await createDefaultAdminUsers(dataSource, tenant);
			await createDefaultEmployeesUsers(dataSource, tenant);

			const users: SeededUser[] = await dataSource.getRepository(User).find({
				select: { email: true, emailVerifiedAt: true, lastLoginAt: true },
				order: { email: 'ASC' }
			});
			seeded.users = users.map(({ email, emailVerifiedAt, lastLoginAt }) => ({
				email,
				emailVerifiedAt,
				lastLoginAt
			}));
			const metadata = dataSource.getMetadata(User);
			seeded.insertable = {
				emailVerifiedAt: metadata.findColumnWithPropertyName('emailVerifiedAt').isInsert,
				lastLoginAt: metadata.findColumnWithPropertyName('lastLoginAt').isInsert
			};
		});
		return seeded;
	} finally {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(file, { force: true });
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

describe('The users a seed creates in an empty database (#11859)', () => {
	let seeded: Seeded;

	beforeAll(async () => {
		seeded = await seedAnEmptyDatabase();
	}, 180_000);

	it('creates the demo accounts: the super admin, the admin and the employee', () => {
		expect(seeded.users.length).toBeGreaterThanOrEqual(3);
	});

	it('marks every one of them as having confirmed their e-mail address', () => {
		const unverified = seeded.users.filter((user) => !user.emailVerifiedAt).map((user) => user.email);

		expect(unverified).toEqual([]);
	});

	it('gives every one of them a last sign-in time', () => {
		const neverSignedIn = seeded.users.filter((user) => !user.lastLoginAt).map((user) => user.email);

		expect(neverSignedIn).toEqual([]);
	});

	it('still keeps both columns out of the INSERT of a user, so an API create cannot set them', () => {
		expect(seeded.insertable).toEqual({ emailVerifiedAt: false, lastLoginAt: false });
	});
});
