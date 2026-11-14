import * as fs from 'fs';
import * as path from 'path';
import { QueryRunner } from 'typeorm';
import { EmailTemplateUtils } from '../email-template/utils';
import { RedesignDefaultEmailTemplates1791000009150 } from './migrations/1791000009150-RedesignDefaultEmailTemplates';

/**
 * The redesign changed every default email template, so the migration has to rewrite every folder that ships. A
 * folder it skips keeps its earlier design on each installation that already has it: `email-appointment` is the
 * one the enum does not list, and the reason this reads the folders rather than the enum.
 */
describe('RedesignDefaultEmailTemplates1791000009150', () => {
	const TEMPLATES_ROOT = path.join(__dirname, '../core/seeds/data/default-email-templates');
	const queryRunner = {} as QueryRunner;

	let migrate: jest.SpyInstance;

	beforeEach(() => {
		migrate = jest.spyOn(EmailTemplateUtils, 'migrateEmailTemplates').mockResolvedValue(undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The template folders the migration wrote, in the order it wrote them. */
	const migrated = (): string[] => migrate.mock.calls.map(([, folder]) => folder);

	it('rewrites every template folder that ships', async () => {
		const folders = fs
			.readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

		await new RedesignDefaultEmailTemplates1791000009150().up(queryRunner);

		expect(folders).toContain('email-appointment');
		expect(migrated().sort()).toEqual(folders.sort());
		expect(migrate.mock.calls.every(([runner]) => runner === queryRunner)).toBe(true);
	});

	it('goes on with the other templates when one cannot be written', async () => {
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		migrate.mockImplementation(async (_runner: unknown, folder: string) => {
			if (folder === 'password') {
				throw new Error('disk full');
			}
		});

		await expect(new RedesignDefaultEmailTemplates1791000009150().up(queryRunner)).resolves.toBeUndefined();

		expect(migrated()).toContain('email-appointment');
		expect(migrated().indexOf('password')).toBeLessThan(migrated().length - 1);
		expect(error).toHaveBeenCalledTimes(1);
		expect(error.mock.calls[0][0]).toContain('password');
	});

	it('has nothing to undo', async () => {
		await expect(new RedesignDefaultEmailTemplates1791000009150().down()).resolves.toBeUndefined();

		expect(migrate).not.toHaveBeenCalled();
	});
});
