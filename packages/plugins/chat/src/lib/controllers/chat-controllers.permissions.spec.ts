/**
 * `CHAT_VIEW` on every chat route, the writes included.
 *
 * A write route states its own permission (`CHAT_SEND`, `CHAT_MANAGE`), which replaces the controller's `CHAT_VIEW`
 * (the guard reads `getAllAndOverride`) and is read as an alternative anyway: the guard lets a role with `CHAT_SEND`
 * and no `CHAT_VIEW` through. Every handler reads its caller from `ChatAccessService.caller()`, which checks
 * `CHAT_VIEW` itself; this suite calls every handler of both controllers to hold that.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as in the resolver spec;
 * its `RequestContext` is the request each test signs in.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata('permissions', permissions),
		UUIDValidationPipe: class UUIDValidationPipe {},
		MultiORMColumn: decorator,
		ColumnIndex: decorator,
		MultiORMEntity: decorator,
		UseValidationPipe: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: {
			currentTenantId: jest.fn(),
			currentUserId: jest.fn(),
			currentOrganizationId: jest.fn(),
			currentEmployeeId: jest.fn(),
			currentUser: jest.fn(),
			hasPermission: jest.fn()
		}
	};
	// Any other name: a function that serves as a no-op decorator and as a base class.
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));
jest.mock('@gauzy/plugin-search', () => ({ SearchService: class SearchService {} }));
jest.mock('@gauzy/scheduler', () => ({ SchedulerQueueService: class SchedulerQueueService {} }));

import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatConversationService } from '../services/chat-conversation.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatSearchService } from '../services/chat-search.service';
import { ChatDraftUploadService } from '../services/chat-draft-upload.service';
import { ChatTaskCardService } from '../services/chat-task-card.service';
import { ChatTypingService } from '../services/chat-typing.service';
import { ChatLinkPreviewImageService } from '../link-preview/chat-link-preview-image.service';
import { ChatLinkPreviewService } from '../link-preview/chat-link-preview.service';
import { ChatConversationController } from './chat-conversation.controller';
import { ChatLinkPreviewController } from './chat-link-preview.controller';
import { ChatMessageController } from './chat-message.controller';

const ID = '7b1a3c0e-0000-4000-8000-000000000001';

/** A service double whose every method resolves; records what was reached. */
function serviceDouble<T>(reached: string[]): T {
	return new Proxy({}, { get: (_target, name) => () => { reached.push(String(name)); return Promise.resolve({}); } }) as T;
}

function handlersOf(controller: object): string[] {
	const prototype = Object.getPrototypeOf(controller);
	return Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor' && typeof prototype[name] === 'function');
}

/** Arguments that satisfy every handler's signature (ids, an emoji, a body, a query). */
const ARGS = [ID, { employeeIds: [ID], name: 'x', body: 'x', q: 'x', snapshotId: ID, setHeader: () => undefined }, ID];

function controllers() {
	const reached: string[] = [];
	const access = new ChatAccessService({} as DataSource);
	const messages = serviceDouble<ChatMessageService>(reached);
	return {
		reached,
		all: [
			new ChatConversationController(access, serviceDouble<ChatConversationService>(reached), messages, serviceDouble<ChatTypingService>(reached)),
			new ChatMessageController(
				access,
				messages,
				serviceDouble<ChatSearchService>(reached),
				serviceDouble<ChatTaskCardService>(reached),
				serviceDouble<ChatDraftUploadService>(reached)
			),
			new ChatLinkPreviewController(access, serviceDouble<ChatLinkPreviewService>(reached), {
				// The picture route sends bytes: its double answers a picture.
				image: () => {
					reached.push('image');
					return Promise.resolve({ type: 'image/png', body: Buffer.from('png') });
				}
			} as unknown as ChatLinkPreviewImageService)
		] as object[]
	};
}

function signIn(granted: PermissionsEnum[]) {
	type Doubled = 'currentTenantId' | 'currentUserId' | 'currentOrganizationId' | 'currentEmployeeId' | 'currentUser' | 'hasPermission';
	const context = RequestContext as unknown as Record<Doubled, jest.Mock>;
	context.currentTenantId.mockReturnValue('ten');
	context.currentUserId.mockReturnValue('u1');
	context.currentOrganizationId.mockReturnValue('org');
	context.currentEmployeeId.mockReturnValue('e1');
	context.currentUser.mockReturnValue({ id: 'u1', employeeId: 'e1' });
	context.hasPermission.mockImplementation((permission: PermissionsEnum) => granted.includes(permission));
}

async function call(controller: object, name: string): Promise<unknown> {
	return (controller as Record<string, (...args: unknown[]) => unknown>)[name](...ARGS);
}

describe('chat routes need CHAT_VIEW, writes included', () => {
	it('covers the write routes (handlers that state a permission of their own)', () => {
		const handlers = controllers().all.flatMap(handlersOf);
		expect(handlers).toEqual(
			expect.arrayContaining(['send', 'createChannel', 'direct', 'createCategory', 'updateCategory', 'deleteCategory', 'addMembers', 'edit', 'remove', 'react', 'pin', 'createTask', 'updateTask', 'discardAttachment', 'reorderCategories', 'typing', 'preview', 'image'])
		);
	});

	it('refuses every handler to a role with CHAT_SEND and CHAT_MANAGE but no CHAT_VIEW, before any service is reached', async () => {
		signIn([PermissionsEnum.CHAT_SEND, PermissionsEnum.CHAT_MANAGE]);
		const { all, reached } = controllers();
		let refused = 0;
		for (const controller of all) {
			for (const name of handlersOf(controller)) {
				await expect(call(controller, name)).rejects.toBeInstanceOf(ForbiddenException);
				refused++;
			}
		}
		expect(refused).toBeGreaterThan(30);
		expect(reached).toEqual([]);
	});

	it('lets every handler through to its service with CHAT_VIEW', async () => {
		signIn([PermissionsEnum.CHAT_VIEW, PermissionsEnum.CHAT_SEND]);
		const { all, reached } = controllers();
		let handlers = 0;
		for (const controller of all) {
			for (const name of handlersOf(controller)) {
				await call(controller, name);
				handlers++;
			}
		}
		expect(reached.length).toBeGreaterThanOrEqual(handlers);
	});

	it('reads CHAT_MANAGE as before once CHAT_VIEW is there', () => {
		signIn([PermissionsEnum.CHAT_VIEW, PermissionsEnum.CHAT_MANAGE]);
		expect(new ChatAccessService({} as DataSource).caller()).toEqual({ tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: true });
		signIn([PermissionsEnum.CHAT_VIEW]);
		expect(new ChatAccessService({} as DataSource).caller().canManage).toBe(false);
	});
});
