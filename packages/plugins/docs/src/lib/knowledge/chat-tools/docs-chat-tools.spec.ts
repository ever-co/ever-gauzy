/**
 * Per-turn gating and citation emission of the Documents chat tools (07 §11.1 / §11.3).
 *
 * Two properties are asserted here, and both were real defects:
 *
 * 1. **The feature flag is read from the DATABASE, per organization.** The gate used to read the
 *    process-wide `gauzyToggleFeatures` map, so an organization that had switched Documents off
 *    still got `docs_search` / `docs_read` — these tools call the search/read services directly,
 *    so `FeatureFlagGuard` never runs on this path and there is no second line of defense.
 * 2. **A search emits clickable citations as a data part**, not merely as tool output. Tool output
 *    goes to the MODEL, which is free to paraphrase or invent a link; the chips the user clicks
 *    must be built from what retrieval actually returned in their own RBAC scope.
 *
 * Every heavy collaborator is stubbed at the module boundary — importing `@gauzy/core` or the
 * document services for real would pull the whole Nest application graph into a unit test.
 */
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../../services/docs-feature.service', () => ({ DocsFeatureService: class {} }));
// `RequestContext` is the only thing this service takes from core; importing core for real
// would drag the whole application graph in. The spies are created INSIDE the factory (and read
// back through the import below) so they exist by the time the module under test requires them.
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		hasPermission: jest.fn(() => true),
		currentTenantId: jest.fn(() => 'tenant-1'),
		currentOrganizationId: jest.fn(() => 'org-1')
	}
}));
jest.mock('../../docs.config', () => ({ getDocsConfig: () => config }));

import { DocumentKindEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DocsChatToolsService, DOCS_CHAT_TOOL_FACTORY_ID } from './docs-chat-tools.service';
import { DOCS_CITATIONS_DATA_PART } from './docs-citations';
import { IDocsKnowledgeSearchHit } from './docs-knowledge-search.types';

/** Mutated per test — read lazily by the mocked `getDocsConfig`. */
const config: { aiEnabled: boolean } = { aiEnabled: true };

const requestContext = RequestContext as unknown as {
	hasPermission: jest.Mock;
	currentTenantId: jest.Mock;
	currentOrganizationId: jest.Mock;
};

/** One retrieval hit with a full locator, so every citation field is exercised. */
const hit = (overrides: Partial<IDocsKnowledgeSearchHit> = {}): IDocsKnowledgeSearchHit => ({
	chunkId: 'chunk-1',
	documentId: 'doc-1',
	chunkIndex: 2,
	score: 0.87,
	content: 'Reimbursements are filed within 30 days.',
	locator: { headingPath: ['Policies', 'Expenses'], page: 4 },
	document: { id: 'doc-1', name: 'Employee Handbook', kind: DocumentKindEnum.FILE },
	...overrides
});

/**
 * Captures the factory the service registers with the (stubbed) AI chat registry, so a "chat
 * turn" is just a call to that factory.
 */
const buildService = (
	options: {
		featureEnabled?: boolean;
		hits?: IDocsKnowledgeSearchHit[];
		lowConfidence?: boolean;
	} = {}
) => {
	const registered: { factory?: (context: any) => Promise<any> } = {};
	const aiChat = {
		AiChatToolRegistry: {
			register: jest.fn((id: string, factory: any) => {
				expect(id).toBe(DOCS_CHAT_TOOL_FACTORY_ID);
				registered.factory = factory;
			}),
			unregister: jest.fn()
		},
		// `tool()` is identity here: the returned definition is what the test invokes directly.
		loadAiSdk: jest.fn(async () => ({ tool: (definition: any) => definition }))
	};

	const isEnabledFor = jest.fn(async () => options.featureEnabled !== false);
	const search = jest.fn(async () => ({
		hits: options.hits ?? [hit()],
		lowConfidence: options.lowConfidence ?? false,
		degraded: 'none' as const
	}));

	const service = new DocsChatToolsService({} as any, { isEnabledFor } as any, { search } as any);
	// The package is feature-detected through `require`, which cannot be intercepted per-instance.
	(service as any).loadAiChatPackage = () => aiChat;
	service.onModuleInit();

	return { service, aiChat, isEnabledFor, search, run: (context: any = {}) => registered.factory(context) };
};

describe('DocsChatToolsService', () => {
	beforeEach(() => {
		config.aiEnabled = true;
		requestContext.hasPermission.mockReturnValue(true);
		requestContext.currentTenantId.mockReturnValue('tenant-1');
		requestContext.currentOrganizationId.mockReturnValue('org-1');
	});

	describe('availability', () => {
		it('contributes both tools when the organization has the feature on', async () => {
			const { run, isEnabledFor } = buildService();

			const contribution = await run();

			expect(Object.keys(contribution.tools).sort()).toEqual(['docs_read', 'docs_search']);
			expect(isEnabledFor).toHaveBeenCalledWith('tenant-1', 'org-1');
		});

		it('contributes NOTHING when FEATURE_DOCUMENTS is off for the organization', async () => {
			const { run } = buildService({ featureEnabled: false });

			await expect(run()).resolves.toEqual({ tools: {} });
		});

		it('resolves the flag per organization, not from process config', async () => {
			requestContext.currentOrganizationId.mockReturnValue('org-2');
			const { run, isEnabledFor } = buildService();

			await run();

			expect(isEnabledFor).toHaveBeenCalledWith('tenant-1', 'org-2');
		});

		it('still gates on the master AI switch', async () => {
			config.aiEnabled = false;
			const { run, isEnabledFor } = buildService();

			await expect(run()).resolves.toEqual({ tools: {} });
			expect(isEnabledFor).not.toHaveBeenCalled();
		});

		it("still gates on the caller's DOCS_READ", async () => {
			requestContext.hasPermission.mockReturnValue(false);
			const { run, isEnabledFor } = buildService();

			await expect(run()).resolves.toEqual({ tools: {} });
			expect(isEnabledFor).not.toHaveBeenCalled();
		});

		it('does not park the tools when the turn carries no tenant to scope the flag by', async () => {
			requestContext.currentTenantId.mockReturnValue(null);
			const { run, isEnabledFor } = buildService();

			const contribution = await run();

			expect(Object.keys(contribution.tools)).toHaveLength(2);
			expect(isEnabledFor).not.toHaveBeenCalled();
		});
	});

	describe('docs_search citations', () => {
		it('writes a citation data part with the in-app deep link and locator', async () => {
			const writeData = jest.fn();
			const { run } = buildService();

			const { tools } = await run({ writeData });
			await tools.docs_search.execute({ query: 'expense policy' });

			expect(writeData).toHaveBeenCalledTimes(1);
			expect(writeData).toHaveBeenCalledWith({
				type: DOCS_CITATIONS_DATA_PART,
				data: {
					citations: [
						{
							documentId: 'doc-1',
							name: 'Employee Handbook',
							kind: DocumentKindEnum.FILE,
							url: '/pages/documents?id=doc-1',
							heading: 'Expenses',
							page: 4,
							chunkIndex: 2,
							score: 0.87
						}
					]
				}
			});
		});

		it('links a PAGE to the page editor rather than to the hub detail panel', async () => {
			const writeData = jest.fn();
			const { run } = buildService({
				hits: [
					hit({
						document: { id: 'doc-9', name: 'Onboarding', kind: DocumentKindEnum.PAGE },
						documentId: 'doc-9',
						locator: null
					})
				]
			});

			const { tools } = await run({ writeData });
			await tools.docs_search.execute({ query: 'onboarding' });

			expect(writeData.mock.calls[0][0].data.citations[0].url).toBe('/pages/documents/page/doc-9');
		});

		it('flags a weak result set so the chips can say so', async () => {
			const writeData = jest.fn();
			const { run } = buildService({ lowConfidence: true });

			const { tools } = await run({ writeData });
			await tools.docs_search.execute({ query: 'anything' });

			expect(writeData.mock.calls[0][0].data.lowConfidence).toBe(true);
		});

		it('emits nothing when the search found nothing', async () => {
			const writeData = jest.fn();
			const { run } = buildService({ hits: [] });

			const { tools } = await run({ writeData });
			await tools.docs_search.execute({ query: 'nothing here' });

			expect(writeData).not.toHaveBeenCalled();
		});

		it('answers normally on an engine with no data-part seam', async () => {
			const { run } = buildService();

			const { tools } = await run({});
			const result: any = await tools.docs_search.execute({ query: 'expense policy' });

			expect(result.hits).toHaveLength(1);
			expect(result.hits[0].url).toBe('/pages/documents?id=doc-1');
		});

		it('never fails the turn because a chip could not be written', async () => {
			const writeData = jest.fn(() => {
				throw new Error('stream closed');
			});
			const { run } = buildService();

			const { tools } = await run({ writeData });
			const result: any = await tools.docs_search.execute({ query: 'expense policy' });

			expect(result.hits).toHaveLength(1);
			expect(result.error).toBeUndefined();
		});
	});
});
