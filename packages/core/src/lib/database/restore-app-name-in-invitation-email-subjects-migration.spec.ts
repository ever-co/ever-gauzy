import { QueryRunner } from 'typeorm';
import { EmailTemplateUtils } from '../email-template/utils';
import { RestoreAppNameInInvitationEmailSubjects1791000011300 } from './migrations/1791000011300-RestoreAppNameInInvitationEmailSubjects';

/**
 * The redesign's migration reads the template files when it runs. An installation that ran it before the invitation
 * subjects named the app again keeps the subjects without the name, unless this one writes those templates again.
 */
describe('RestoreAppNameInInvitationEmailSubjects1791000011300', () => {
	const INVITATIONS = ['invite-employee', 'invite-gauzy-teams', 'invite-user'];
	const queryRunner = {} as QueryRunner;

	let migrate: jest.SpyInstance;

	beforeEach(() => {
		migrate = jest.spyOn(EmailTemplateUtils, 'migrateEmailTemplates').mockResolvedValue(undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The template folders the migration wrote, in the order it wrote them. */
	const migrated = (): string[] => migrate.mock.calls.map(([, folder]) => folder);

	it('writes the three invitations again, and no other template', async () => {
		await new RestoreAppNameInInvitationEmailSubjects1791000011300().up(queryRunner);

		expect(migrated().sort()).toEqual(INVITATIONS);
		expect(migrate.mock.calls.every(([runner]) => runner === queryRunner)).toBe(true);
	});

	it('goes on with the other invitations when one cannot be written', async () => {
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		migrate.mockImplementation(async (_runner: unknown, folder: string) => {
			if (folder === 'invite-user') {
				throw new Error('disk full');
			}
		});

		await expect(
			new RestoreAppNameInInvitationEmailSubjects1791000011300().up(queryRunner)
		).resolves.toBeUndefined();

		expect(migrated().sort()).toEqual(INVITATIONS);
		expect(error).toHaveBeenCalledTimes(1);
		expect(error.mock.calls[0][0]).toContain('invite-user');
	});

	it('has nothing to undo', async () => {
		await expect(new RestoreAppNameInInvitationEmailSubjects1791000011300().down()).resolves.toBeUndefined();

		expect(migrate).not.toHaveBeenCalled();
	});
});
