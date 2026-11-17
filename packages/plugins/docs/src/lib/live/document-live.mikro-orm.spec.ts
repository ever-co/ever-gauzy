/**
 * A live page is saved from a timer (the debounce, a retry), as its last session leaves, or as the process stops: never
 * in a request. Under DB_ORM=mikro-orm the content save goes through MikroORM (`DocumentService.saveLiveContent` →
 * `DocumentVersionService.create`, `save`), which refuses its global EntityManager outside a MikroORM request context:
 * every save failed and was retried forever. Each save now runs in a MikroORM request context of its own, opened inside
 * the async scope of the editor it is saved as (restoring that scope would drop a context opened around it).
 *
 * `@gauzy/core` boots the whole application graph from its barrel, so the few names the live service takes from it are
 * doubled; the context opener mirrors the platform's on MikroORM's own `RequestContext`. The save itself
 * (`persistNow`) is doubled by one that, as MikroORM does, refuses to run outside a MikroORM request context.
 */
jest.mock('@gauzy/core', () => ({
	currentSubscriberScope: () => null,
	currentSubscriberUserId: () => null,
	EventBus: class {},
	GraphqlPubSub: class {},
	RequestContext: { currentUserId: () => null, currentTenantId: () => null, currentOrganizationId: () => null },
	runInMikroOrmContext: (orm: { em: unknown } | null | undefined, work: () => Promise<unknown>) =>
		orm && process.env.DB_ORM === 'mikro-orm'
			? jest.requireActual('@mikro-orm/core').RequestContext.create(orm.em, work)
			: work()
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({}) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../events/document.event', () => ({ DocumentEvent: class {} }));
jest.mock('../services/document.service', () => ({ claimNextContentRevision: jest.fn(), DocumentService: class {} }));
jest.mock('../services/document-live.bridge', () => ({ DocumentLiveBridge: class {} }));
jest.mock('../validation', () => ({ validateTiptapDocument: jest.fn() }));

import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { DocumentLiveService } from './document-live.service';

/** The editor a save runs as, kept in an AsyncLocalStorage as the request context store keeps it. */
const editor = new AsyncLocalStorage<string>();

describe('DocumentLiveService saves under DB_ORM=mikro-orm', () => {
	const originalOrm = process.env.DB_ORM;

	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

	/** The service, a page with unsaved edits by `who`, and the contexts its saves ran in. */
	function pageEditedBy(who: string, orm?: unknown) {
		const service = new DocumentLiveService(
			{} as never,
			{} as never,
			{} as never,
			{ ofType: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }) } as never,
			orm as never
		);
		const savedIn: Array<{ em: unknown; as: string | undefined }> = [];
		jest.spyOn(service as unknown as { persistNow: () => Promise<boolean> }, 'persistNow').mockImplementation(
			async () => {
				const em = MikroOrmRequestContext.getEntityManager();
				if (process.env.DB_ORM === 'mikro-orm' && !em) {
					throw new Error(
						'Using global EntityManager instance methods for context specific actions is disallowed.'
					);
				}
				savedIn.push({ em, as: editor.getStore() });
				return true;
			}
		);
		// The session's async scope, captured where the editor opened it, as the live service captures it.
		const context = editor.run(who, () => new AsyncResource('DocsLiveSession'));
		const live = { dirty: true, dirtyRemote: false, unloaded: false, lastWriter: { context }, sessions: new Map() };
		const persist = () => (service as unknown as { persist: (page: unknown) => Promise<boolean> }).persist(live);
		return { persist, savedIn };
	}

	it('saves as the editor and in a MikroORM request context of its own, a fresh one each save', async () => {
		process.env.DB_ORM = 'mikro-orm';
		let forks = 0;
		const orm = { em: { name: 'default', fork: jest.fn(() => ({ name: 'default', fork: ++forks })) } };
		const { persist, savedIn } = pageEditedBy('ann', orm);

		expect(await persist()).toBe(true);
		expect(await persist()).toBe(true);

		expect(savedIn).toEqual([
			{ em: { name: 'default', fork: 1 }, as: 'ann' },
			{ em: { name: 'default', fork: 2 }, as: 'ann' }
		]);
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('opens none under TypeORM: the save runs as it is, as the editor', async () => {
		process.env.DB_ORM = 'typeorm';
		const orm = { em: { name: 'default', fork: jest.fn() } };
		const { persist, savedIn } = pageEditedBy('bob', orm);

		expect(await persist()).toBe(true);

		expect(savedIn).toEqual([{ em: undefined, as: 'bob' }]);
		expect(orm.em.fork).not.toHaveBeenCalled();
	});
});
