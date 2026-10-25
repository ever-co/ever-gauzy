// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { InviteService } from '../invite/invite.service';
import { UserCreateCommand } from '../user/commands/user.create.command';
import { UserCreateHandler } from '../user/commands/handlers/user.create.handler';
import { UserService } from '../user/user.service';
import { assertFirstPartyRequest } from './oauth-app-first-party';

/**
 * Owner decision Q12 (2026-10-24): some actions stay with the user's own session whatever a third-party app's scopes.
 * Each is opened by a permission a write scope reaches — `ORG_EMPLOYEES_EDIT` / `ORG_CANDIDATES_EDIT` create the
 * employee's or candidate's account with a password the caller chose, `ORG_TEAM_ADD` sends invitations, `ALL_ORG_EDIT`
 * deletes users — so the permission map cannot close them: they refuse an OAuth-app token where the action happens.
 */
describe('first-party-only actions refuse an OAuth-app token (owner decision Q12)', () => {
	/** A request authenticated by an OAuth-app token, as JwtStrategy records it. */
	const asOAuthApp = () =>
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['zap', 'zap:write', 'authentication']);

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('passes a first-party request and refuses an OAuth-app one', () => {
		expect(() => assertFirstPartyRequest('Anything')).not.toThrow();

		asOAuthApp();
		expect(() => assertFirstPartyRequest('Creating a user account')).toThrow(ForbiddenException);
	});

	describe('creating an account (POST /user, and the account POST /employee and POST /candidate create)', () => {
		const build = () => {
			const create = jest.fn(async (input: any) => ({ id: 'new-user', ...input }));
			const assertCanAssignRoles = jest.fn(async () => undefined);
			return { handler: new UserCreateHandler({ create, assertCanAssignRoles } as any), create };
		};
		const command = () => new UserCreateCommand({ email: 'app-chosen@example.com', hash: '$2b$10$app' } as any);

		it('is refused before anything is written', async () => {
			asOAuthApp();
			const { handler, create } = build();

			await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('still works in the user’s own session', async () => {
			const { handler, create } = build();

			await expect(handler.execute(command())).resolves.toMatchObject({ id: 'new-user' });
			expect(create).toHaveBeenCalledTimes(1);
		});
	});

	it('refuses deleting a user (DELETE /user/:id also admits ALL_ORG_EDIT)', async () => {
		asOAuthApp();
		const service: UserService = Object.create(UserService.prototype);

		await expect(service.delete('7c000000-0000-4000-8000-000000000001')).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses sending invitations, inviting a contact and creating an account from an invitation', async () => {
		asOAuthApp();
		const service: InviteService = Object.create(InviteService.prototype);

		await expect(
			service.createBulk({ emailIds: ['app-chosen@example.com'] } as any, LanguagesEnum.ENGLISH)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.createOrganizationContactInvite({ emailId: 'app-chosen@example.com' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.createUser({ user: { email: 'app-chosen@example.com' } } as any, 'team-1', LanguagesEnum.ENGLISH)
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});
