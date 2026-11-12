jest.mock('../jira-process', () => ({ jiraSyncUser: () => ({}), runInJiraContext: (_user: unknown, work: () => unknown) => work() }));

import { Logger } from '@nestjs/common';
import { JiraIssue } from '../client/jira-api.client';
import { JiraSyncService } from './jira-sync.service';

type ImportMapping = (tenant: unknown, mapping: unknown, run: unknown, options?: { full?: boolean }) => Promise<void>;
const importMapping = (JiraSyncService.prototype as unknown as { importMapping: ImportMapping }).importMapping;

const issue = (id: string, updated: string) => ({ id, key: `ACME-${id}`, fields: { updated } }) as unknown as JiraIssue;

/**
 * An import over two pages, with the run's heartbeat answering `progress` in turn (false: a later claim failed the run
 * as abandoned) and `live` at the end.
 */
function harness(progress: boolean[], live = true) {
	const pages = [
		{ issues: [issue('1', '2026-11-10T08:00:00.000+0000')], nextPageToken: 'page-2' },
		{ issues: [issue('2', '2026-11-10T09:00:00.000+0000')], nextPageToken: null }
	];
	const runs = { progress: jest.fn(), isLive: jest.fn(async () => live), finish: jest.fn(async () => undefined) };
	for (const answer of progress) runs.progress.mockResolvedValueOnce(answer);
	const self = {
		runs,
		mappings: { recordImport: jest.fn(async () => undefined) },
		tenants: { setAttention: jest.fn(), settingsOf: () => ({}) },
		integrationTenantSyncService: { recordSyncCompleted: jest.fn(async () => undefined) },
		connectedByUserId: () => null,
		openContext: async () => ({ issueTypeIds: null }),
		call: async (_holder: unknown, make: (client: unknown) => Promise<unknown>) => make({ searchIssues: async () => pages.shift() }),
		applyOne: jest.fn(async () => true),
		linkParents: async () => undefined,
		linkRelations: async () => undefined,
		reportDetails: () => undefined,
		logger: new Logger('spec'),
		describe: (error: unknown) => String(error)
	};
	const tenant = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1' };
	const mapping = { id: 'map-1', jiraProjectId: '10000', lastCursor: null };
	const run = { id: 'run-1', requestedByUserId: null };
	return { self, run: () => importMapping.call(self, tenant, mapping, run), runs };
}

beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('an import run a later claim failed as abandoned', () => {
	it('a run that still holds its mapping writes its position and its outcome', async () => {
		const { self, run, runs } = harness([true, true]);
		await run();
		expect(self.applyOne).toHaveBeenCalledTimes(2);
		expect(self.mappings.recordImport).toHaveBeenCalledTimes(1);
		expect(runs.finish).toHaveBeenCalledTimes(1);
		expect(self.integrationTenantSyncService.recordSyncCompleted).toHaveBeenCalledTimes(1);
	});

	it('stops at the heartbeat that finds it failed: no further page, no position, no outcome', async () => {
		const { self, run, runs } = harness([false]);
		await run();
		expect(self.applyOne).toHaveBeenCalledTimes(1);
		expect(self.mappings.recordImport).not.toHaveBeenCalled();
		expect(runs.finish).not.toHaveBeenCalled();
		expect(self.integrationTenantSyncService.recordSyncCompleted).not.toHaveBeenCalled();
	});

	it('writes nothing when it was failed after its last heartbeat', async () => {
		const { self, run, runs } = harness([true, true], false);
		await run();
		expect(self.applyOne).toHaveBeenCalledTimes(2);
		expect(self.mappings.recordImport).not.toHaveBeenCalled();
		expect(runs.finish).not.toHaveBeenCalled();
	});
});
