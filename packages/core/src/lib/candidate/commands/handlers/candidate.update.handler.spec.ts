// Must stay first: loads the entity graph before the handler pulls an entity (see activity.controller.spec.ts).
import '../../../core/entities/internal';

import { CandidateUpdateCommand } from '../candidate.update.command';
import { CandidateUpdateHandler } from './candidate.update.handler';

/**
 * GHSA-jh6m-9fxr-rx3c — PUT /candidate/:id.
 *
 * `Candidate.user` is a cascading owner relation and the route does not whitelist its body, so a
 * nested `user: { id, hash }` reached `create({ ...input, id })` and rewrote that user's password — any
 * user's, a same-tenant super admin included. The candidate screens edit the user through PUT /user/:id,
 * never through this route.
 */
describe('CandidateUpdateHandler (GHSA-jh6m-9fxr-rx3c)', () => {
	const exploit = {
		id: 'candidate-1',
		appliedDate: new Date('2026-01-01'),
		user: { id: 'super-admin', hash: '$2b$10$attacker' },
		userId: 'super-admin'
	} as any;

	it('CONTROL: the pre-fix payload hands the nested user to create()', () => {
		expect({ ...exploit, id: exploit.id }).toMatchObject({ user: { hash: '$2b$10$attacker' }, userId: 'super-admin' });
	});

	it('never passes the user or userId on to create()', async () => {
		const create = jest.fn(async (entity: any) => entity);
		const handler = new CandidateUpdateHandler({ create } as any);

		await handler.execute(new CandidateUpdateCommand(exploit));

		const [persisted] = create.mock.calls[0];
		expect(persisted).toEqual({ id: 'candidate-1', appliedDate: exploit.appliedDate });
		// The command input is left as it was.
		expect(exploit.user).toBeDefined();
	});
});
