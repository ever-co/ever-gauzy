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

/**
 * Privilege-escalation audit 2026-10-24, F9 (the candidate twin): `Candidate.contact` cascades by id like
 * `Employee.contact`, and `PUT /candidate/:id` does not whitelist its body, so a nested contact id (or `contactId`)
 * linked the candidate to another contact of the tenant and overwrote it.
 */
describe('CandidateUpdateHandler — the contact is the candidate’s own', () => {
	const stored = {
		id: 'candidate-1',
		contactId: 'contact-own',
		tenantId: 'tenant-1',
		organizationId: 'organization-1'
	};

	const run = async (input: Record<string, unknown>, read: Record<string, unknown> = stored) => {
		const create = jest.fn(async (entity: any) => entity);
		const findOneByIdString = jest.fn().mockResolvedValue(read);
		const handler = new CandidateUpdateHandler({ create, findOneByIdString } as any);

		await handler.execute(new CandidateUpdateCommand({ id: 'candidate-1', ...input } as any));

		return { persisted: create.mock.calls[0][0], findOneByIdString };
	};

	it('drops a contact id that is not the candidate’s own, and stamps the candidate’s scope', async () => {
		const { persisted, findOneByIdString } = await run({
			contact: { id: 'contact-of-a-client', city: 'Sofia', organizationId: 'organization-other' }
		});

		expect(findOneByIdString).toHaveBeenCalledWith('candidate-1', {
			relations: { contact: true, organization: true }
		});
		expect(persisted.contact).toEqual({ city: 'Sofia', tenantId: 'tenant-1', organizationId: 'organization-1' });
	});

	it('keeps the candidate’s own contact id', async () => {
		const { persisted } = await run({ contact: { id: 'contact-own', city: 'Sofia' } });

		expect(persisted.contact).toMatchObject({ id: 'contact-own', city: 'Sofia' });
	});

	it('keeps it when the read answers the links as relations only, as MikroORM does', async () => {
		const { persisted } = await run(
			{ contact: { id: 'contact-own', city: 'Sofia' } },
			{
				id: 'candidate-1',
				tenantId: 'tenant-1',
				contact: { id: 'contact-own' },
				organization: { id: 'organization-1' }
			}
		);

		expect(persisted.contact).toEqual({
			id: 'contact-own',
			city: 'Sofia',
			tenantId: 'tenant-1',
			organizationId: 'organization-1'
		});
	});

	it('never re-links the candidate through contactId, and reads nothing when no contact is sent', async () => {
		const { persisted, findOneByIdString } = await run({ contactId: 'contact-of-a-client', cvUrl: 'https://cv' });

		expect(persisted).toEqual({ id: 'candidate-1', cvUrl: 'https://cv' });
		expect(findOneByIdString).not.toHaveBeenCalled();
	});
});
