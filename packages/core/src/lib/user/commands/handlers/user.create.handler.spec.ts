// Must stay first: loads the entity graph before the handler pulls an entity (see candidate.update.handler.spec.ts).
import '../../../core/entities/internal';

import { UserCreateCommand } from '../user.create.command';
import { UserCreateHandler } from './user.create.handler';

/**
 * GHSA-jh6m-9fxr-rx3c (same class as the candidate → user cascade).
 *
 * `CrudService.create()` upserts when the payload carries a primary key (TypeORM `save()`, and the
 * MikroORM branch loads the row and `assign()`s onto it). So a body id turned "create a user" into
 * "overwrite that user": POST /candidate and POST /employee hash the request's `password` into the
 * payload they hand this command, which meant `user: { id: <an admin of my own tenant> }` reset that
 * account's password and demoted its role. The tenant check cannot see it — the victim is a member
 * of the caller's own tenant — and no caller of this command wants an update.
 */
describe('UserCreateHandler (GHSA-jh6m-9fxr-rx3c)', () => {
	const build = () => {
		const create = jest.fn(async (input: any) => ({ id: 'new-user', ...input }));
		const assertCanAssignRoles = jest.fn(async () => undefined);
		const handler = new UserCreateHandler({ create, assertCanAssignRoles } as any);
		return { handler, create, assertCanAssignRoles };
	};

	const takeover = {
		id: 'victim-super-admin',
		email: 'attacker@evil.test',
		hash: '$2b$10$attacker',
		roleId: 'candidate-role'
	} as any;

	it('CONTROL: the pre-fix payload still names the victim row, which create() would upsert', () => {
		expect(takeover).toMatchObject({ id: 'victim-super-admin', hash: '$2b$10$attacker' });
	});

	it('never passes a body-supplied id on to create()', async () => {
		const { handler, create } = build();

		await handler.execute(new UserCreateCommand(takeover));

		const [persisted] = create.mock.calls[0];
		expect(persisted).not.toHaveProperty('id');
		expect(persisted).toMatchObject({ email: 'attacker@evil.test', hash: '$2b$10$attacker' });
		// The command input is left as it was.
		expect(takeover.id).toBe('victim-super-admin');
	});

	it('still validates the role being assigned, whichever form it arrives in', async () => {
		const { handler, assertCanAssignRoles } = build();

		// The two forms agree, which is the only shape `normalizeRolePayload` lets through
		// (GHSA-x4mv-fhwj-g3rp rejects a `role`/`roleId` pair that names two different roles, so that
		// the id which is CHECKED is always the id that is persisted).
		await handler.execute(
			new UserCreateCommand({ email: 'new@test', roleId: 'the-role', role: { id: 'the-role' } } as any)
		);

		// `assertCanAssignRoles` takes the whole payload and extracts every role form itself, so a
		// caller cannot forget one (GHSA-x4mv-fhwj-g3rp).
		expect(assertCanAssignRoles).toHaveBeenCalledWith(
			expect.objectContaining({ roleId: 'the-role', role: { id: 'the-role' } })
		);
	});

	it('refuses a payload whose role and roleId name different roles', async () => {
		const { handler, create } = build();

		await expect(
			handler.execute(
				new UserCreateCommand({ email: 'new@test', roleId: 'flat-role', role: { id: 'relation-role' } } as any)
			)
		).rejects.toThrow(/same role/i);

		expect(create).not.toHaveBeenCalled();
	});
});
