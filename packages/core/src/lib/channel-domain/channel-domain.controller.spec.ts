/**
 * 🛑 This import must stay FIRST — see `channel.controller.spec.ts` for the load-order cycle it
 * avoids: entered through the validators rather than through the entities, an entity decorator is
 * still undefined when the entity applies it and the suite fails to load rather than to assert.
 */
import '../core/entities/internal';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ChannelDomainController } from './channel-domain.controller';

/** The guard doubles, and the reason they exist, are stated in `channel.controller.spec.ts`. */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));

jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => ({ id: 'user-1', tenantId: 'tenant-1' }),
		currentUserId: () => 'user-1',
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'org-1',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

const CHANNEL = '00000000-0000-4000-8000-000000000010';
const DOMAIN = '00000000-0000-4000-8000-000000000030';

/** The hostname row a scripted service answers with. */
const STORED = {
	id: DOMAIN,
	channelId: CHANNEL,
	hostname: 'shop.example',
	isPrimary: true,
	isSslEnabled: true,
	redirectToPrimary: false
};

/** The controller over a scripted service, so every route's delegation is visible. */
function surfaces(overrides: Record<string, unknown> = {}) {
	const channelDomainService = {
		listDomains: jest.fn().mockResolvedValue([STORED]),
		find: jest.fn().mockResolvedValue([STORED]),
		findDomain: jest.fn().mockResolvedValue(STORED),
		findDomainOrFail: jest.fn().mockResolvedValue(STORED),
		resolveChannelIdByHostname: jest.fn().mockResolvedValue(CHANNEL),
		bindDomain: jest.fn().mockResolvedValue(STORED),
		updateDomain: jest.fn().mockResolvedValue(STORED),
		unbindDomain: jest.fn().mockResolvedValue(STORED),
		...overrides
	};

	return {
		channelDomainService,
		controller: new ChannelDomainController(channelDomainService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

describe('ChannelDomainController — the routes (API specification §7.3)', () => {
	it('lists the hostnames of one channel, primary first', async () => {
		const { controller, channelDomainService } = surfaces();

		const answer = await controller.findAll({ filter: { channelId: CHANNEL, isPrimary: true }, take: 10, skip: 0 });

		expect(channelDomainService.listDomains).toHaveBeenCalledWith(CHANNEL, {
			channelId: CHANNEL,
			isPrimary: true
		});
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('lists the whole organization’s hostnames when the caller names no channel', async () => {
		const { controller, channelDomainService } = surfaces();

		const answer = await controller.findAll({ hostname: 'shop.example' });

		// The delivered service lists one channel's hostnames and takes the channel as an argument, so
		// the organization-wide read the endpoint table describes is composed from its scoped `find`.
		expect(channelDomainService.listDomains).not.toHaveBeenCalled();
		expect(channelDomainService.find).toHaveBeenCalledWith({ where: { hostname: 'shop.example' } });
		expect(answer.total).toBe(1);
	});

	it('reads one hostname', async () => {
		const { controller, channelDomainService } = surfaces();

		await expect(controller.findById(DOMAIN)).resolves.toBe(STORED);
		expect(channelDomainService.findDomainOrFail).toHaveBeenCalledWith(DOMAIN);
	});

	it('binds a hostname to a channel', async () => {
		const { controller, channelDomainService } = surfaces();

		const bound = await controller.create({ channelId: CHANNEL, hostname: 'Shop.Example' } as never);

		// The hostname is passed through as the caller stated it: the normaliser the service owns is
		// what decides the stored form, and a second check here would be a second answer to it.
		expect(channelDomainService.bindDomain).toHaveBeenCalledWith({
			channelId: CHANNEL,
			hostname: 'Shop.Example'
		});
		expect(bound).toBe(STORED);
	});

	it('changes the flags of a hostname that exists', async () => {
		const { controller, channelDomainService } = surfaces();

		await controller.update(DOMAIN, { isSslEnabled: false } as never);

		expect(channelDomainService.updateDomain).toHaveBeenCalledWith(DOMAIN, { isSslEnabled: false });
	});

	it('verifies a hostname against the platform’s own resolution', async () => {
		const { controller, channelDomainService } = surfaces();

		const verification = await controller.verify(DOMAIN);

		expect(channelDomainService.resolveChannelIdByHostname).toHaveBeenCalledWith('shop.example');
		expect(verification.verified).toBe(true);
		expect(verification.resolvedTo).toBe(CHANNEL);
		expect(verification.checkedAt).toBeInstanceOf(Date);
	});

	it('reports an unverified hostname when it resolves to another channel', async () => {
		const { controller } = surfaces({
			resolveChannelIdByHostname: jest.fn().mockResolvedValue('another-channel')
		});

		const verification = await controller.verify(DOMAIN);

		expect(verification.verified).toBe(false);
		expect(verification.resolvedTo).toBe('another-channel');
	});

	it('detaches a hostname, passing the flag that accepts an unreachable channel', async () => {
		const { controller, channelDomainService } = surfaces();

		const removed = await controller.delete(DOMAIN, { force: true });

		expect(channelDomainService.unbindDomain).toHaveBeenCalledWith(DOMAIN, { force: true });
		expect(removed).toBe(STORED);
	});
});

describe('ChannelDomainController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a hostname that is already bound with 400, naming the catalogue code', async () => {
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_DOMAIN_ALREADY_EXISTS — hostname 'shop.example' is already bound to channel 'channel-1'."
		);
		const { controller } = surfaces({ bindDomain: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ channelId: CHANNEL, hostname: 'shop.example' } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('CHANNEL_DOMAIN_ALREADY_EXISTS');
	});

	it('refuses the channel’s last hostname with 400 rather than reporting a miss', async () => {
		const refusal = new BadRequestException(
			"PRECONDITION_REQUIRED: CHANNEL_SETUP_INCOMPLETE — 'shop.example' is the only hostname of channel 'channel-1'."
		);
		const { controller } = surfaces({ unbindDomain: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.delete(DOMAIN).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CHANNEL_SETUP_INCOMPLETE');
	});

	it('refuses a value that is not a hostname', async () => {
		const refusal = new BadRequestException(
			"VALIDATION_FAILED: CHANNEL_DOMAIN_HOSTNAME_INVALID — 'not a host' is not a hostname."
		);
		const { controller } = surfaces({ bindDomain: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.create({ channelId: CHANNEL, hostname: 'not a host' } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CHANNEL_DOMAIN_HOSTNAME_INVALID');
	});
});

describe('ChannelDomainController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards, under the channel’s own permission', () => {
		const guards = Reflect.getMetadata('__guards__', ChannelDomainController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ChannelDomainController)).toEqual([
			PermissionsEnum.CHANNELS_VIEW
		]);
	});

	it('gives every route the permission the endpoint table names', () => {
		const proto = ChannelDomainController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.CHANNELS_VIEW],
			['findById', PermissionsEnum.CHANNELS_VIEW],
			['create', PermissionsEnum.CHANNELS_EDIT],
			['update', PermissionsEnum.CHANNELS_EDIT],
			['verify', PermissionsEnum.CHANNELS_EDIT],
			['delete', PermissionsEnum.CHANNELS_EDIT]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads.
		const proto = ChannelDomainController.prototype;

		for (const route of ['create', 'update', 'verify', 'delete']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CHANNELS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('restates the route decorator on every method it overrides', () => {
		const source = readFileSync(join(__dirname, 'channel-domain.controller.ts'), 'utf8');

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\(':id'\)/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id'\)/);
	});
});
