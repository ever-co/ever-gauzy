/**
 * The person's devices: a registration is held to the platform's outbound-endpoint policy, a device is known by its
 * endpoint (registered again: refreshed), and two registrations of one device at once both answer it.
 */
jest.mock('@gauzy/core', () => ({
	...jest.requireActual('@gauzy/core'),
	RequestContext: {
		currentTenantId: () => 'ten',
		currentUserId: () => 'u1',
		currentOrganizationId: () => 'org',
		currentUser: () => ({ id: 'u1', employeeId: 'e1' })
	}
}));

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { endpointHashOf, InboxPushSubscriptionService } from './inbox-push-subscription.service';

const ENDPOINT = 'https://push.example.test/send/abc';
const KEYS = { p256dh: 'p', auth: 'a' };

function fixture(options: { existing?: Record<string, unknown> | null; saveFails?: boolean; afterFailure?: Record<string, unknown> | null } = {}) {
	let found: Record<string, unknown> | null = options.existing ?? null;
	const repository = {
		findOne: jest.fn(async () => found),
		create: jest.fn((row: Record<string, unknown>) => row),
		save: jest.fn(async (row: Record<string, unknown>) => {
			if (options.saveFails) {
				found = options.afterFailure ?? null;
				throw new Error('duplicate key value violates unique constraint');
			}
			return { id: 'new', ...row };
		}),
		update: jest.fn(async () => ({ affected: 1 })),
		delete: jest.fn(async () => ({ affected: 1 })),
		exists: jest.fn(async () => false),
		find: jest.fn(async () => [])
	};
	const dataSource = { getRepository: () => repository } as unknown as DataSource;
	return { repository, service: new InboxPushSubscriptionService(dataSource) };
}

describe('InboxPushSubscriptionService.register', () => {
	it('registers a device of the caller, keyed by the hash of its endpoint', async () => {
		const { service, repository } = fixture();
		const row = await service.register({ endpoint: ENDPOINT, keys: KEYS, expirationTime: 1_800_000_000_000, userAgent: ' Firefox ' });
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', endpoint: ENDPOINT, endpointHash: endpointHashOf(ENDPOINT), p256dh: 'p', auth: 'a', userAgent: 'Firefox', failures: 0 })
		);
		expect((row as { id?: string }).id).toBe('new');
	});

	it('refreshes the device the endpoint names: new keys, failures over', async () => {
		const { service, repository } = fixture({ existing: { id: 'd1', failures: 3 } });
		await service.register({ endpoint: ENDPOINT, keys: { p256dh: 'p2', auth: 'a2' } });
		expect(repository.save).not.toHaveBeenCalled();
		expect(repository.update).toHaveBeenCalledWith({ id: 'd1' }, expect.objectContaining({ p256dh: 'p2', auth: 'a2', failures: 0, expirationTime: null, userAgent: null }));
	});

	it('answers the device when another registration of it won the race', async () => {
		const { service, repository } = fixture({ saveFails: true, afterFailure: { id: 'theirs', failures: 0 } });
		await service.register({ endpoint: ENDPOINT, keys: KEYS });
		expect(repository.update).toHaveBeenCalledWith({ id: 'theirs' }, expect.objectContaining({ p256dh: 'p', auth: 'a', failures: 0 }));
		const lost = fixture({ saveFails: true, afterFailure: null });
		await expect(lost.service.register({ endpoint: ENDPOINT, keys: KEYS })).rejects.toThrow('duplicate key');
	});

	it('refuses an endpoint the platform must not connect to, before it is saved', async () => {
		const { service, repository } = fixture();
		for (const endpoint of ['http://push.example.test/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://localhost/x', 'https://vault/x', 'https://push.internal/x', 'not a url']) {
			await expect(service.register({ endpoint, keys: KEYS })).rejects.toBeInstanceOf(BadRequestException);
		}
		expect(repository.save).not.toHaveBeenCalled();
		expect(repository.update).not.toHaveBeenCalled();
	});
});
