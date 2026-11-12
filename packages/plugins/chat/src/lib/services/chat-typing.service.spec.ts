/**
 * `ChatTypingService`: who is told, how often, and what is refused.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application).
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {}
	};
	// Any other export: a stand-in nothing here calls.
	const anything = function Anything() {
		return undefined;
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : anything) });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CHAT_TYPING_MIN_INTERVAL_MS, CHAT_TYPING_TTL_MS } from '@gauzy/contracts';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatTypingService } from './chat-typing.service';

const caller: IChatCaller & { employeeId: string } = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function over(options: { member?: boolean; archived?: boolean; root?: { id: string; threadRootId: string | null } | null } = {}) {
	const access = {
		requireMember: jest.fn(async () => ({
			conversation: { id: 'c1', organizationId: 'org', archivedAt: options.archived ? new Date() : undefined },
			member: options.member === false ? null : { id: 'mb1' }
		})),
		members: jest.fn(async () => [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }])
	} as unknown as ChatAccessService;
	const realtime = { signalTyping: jest.fn(async () => true) };
	const findOne = jest.fn(async () => (options.root === undefined ? { id: 'r1', threadRootId: null } : options.root));
	const dataSource = { getRepository: () => ({ findOne }) } as unknown as DataSource;
	return { service: new ChatTypingService(dataSource, access, realtime as unknown as ChatRealtime), realtime, findOne };
}

describe('ChatTypingService', () => {
	it("tells the conversation's other members, never the typist, with the time to show it", async () => {
		const { service, realtime } = over();
		await expect(service.typing(caller, 'c1', {}, 1_000_000)).resolves.toEqual({ sent: true, expiresInMs: CHAT_TYPING_TTL_MS });
		expect(realtime.signalTyping).toHaveBeenCalledWith(
			{ conversationId: 'c1', threadRootId: null, employeeId: 'e1', userId: 'u1', at: new Date(1_000_000).toISOString(), expiresInMs: CHAT_TYPING_TTL_MS },
			{ tenantId: 'ten', organizationId: 'org' },
			['u2', 'u3']
		);
	});

	it('tells one place at most once per interval, and each place apart', async () => {
		const { service, realtime } = over();
		await service.typing(caller, 'c1', {}, 1_000_000);
		await expect(service.typing(caller, 'c1', {}, 1_000_000 + CHAT_TYPING_MIN_INTERVAL_MS - 1)).resolves.toEqual({ sent: false, expiresInMs: CHAT_TYPING_TTL_MS });
		await expect(service.typing(caller, 'c1', { threadRootId: 'r1' }, 1_000_001)).resolves.toEqual(expect.objectContaining({ sent: true }));
		await expect(service.typing(caller, 'c1', {}, 1_000_000 + CHAT_TYPING_MIN_INTERVAL_MS)).resolves.toEqual(expect.objectContaining({ sent: true }));
		expect(realtime.signalTyping).toHaveBeenCalledTimes(3);
	});

	it('refuses a non-member (a CHAT_MANAGE reader), an archived conversation and a thread that is not a root here', async () => {
		await expect(over({ member: false }).service.typing(caller, 'c1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(over({ archived: true }).service.typing(caller, 'c1')).rejects.toBeInstanceOf(BadRequestException);
		await expect(over({ root: null }).service.typing(caller, 'c1', { threadRootId: 'r9' })).rejects.toBeInstanceOf(NotFoundException);
		await expect(over({ root: { id: 'r2', threadRootId: 'r1' } }).service.typing(caller, 'c1', { threadRootId: 'r2' })).rejects.toBeInstanceOf(NotFoundException);
	});
});
