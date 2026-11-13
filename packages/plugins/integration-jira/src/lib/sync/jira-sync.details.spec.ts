import { Logger } from '@nestjs/common';
import { JiraComment, JiraIssue } from '../client/jira-api.client';
import { JIRA_ISSUE_COMMENTS_MAX } from '../jira.constants';
import { JiraSyncService } from './jira-sync.service';

type Private = {
	withAllComments(holder: unknown, issue: JiraIssue): Promise<JiraIssue>;
	applyOne(context: unknown, issue: JiraIssue): Promise<boolean>;
};
const proto = JiraSyncService.prototype as unknown as Private;

function comment(id: number): JiraComment {
	return { id: String(id), body: null, created: '2026-11-11T08:00:00.000+0000', updated: '2026-11-11T08:00:00.000+0000', author: null };
}

function issue(comments: JiraComment[], total?: number): JiraIssue {
	return { id: '10001', key: 'ACME-1', fields: { summary: 'One', comment: { comments, total } } } as unknown as JiraIssue;
}

/** The comments of an issue as Jira pages them: `total` in all, `startAt` an offset. */
function pagedComments(total: number) {
	return jest.fn(async (_issueId: string, startAt: number, maxResults: number) => ({
		comments: Array.from({ length: Math.max(0, Math.min(maxResults, total - startAt)) }, (_, index) => comment(startAt + index + 1)),
		total
	}));
}

/** The service's own `call`, without a token to renew: the client answers. */
function withClient(issueComments: jest.Mock) {
	return { call: (_holder: unknown, make: (client: unknown) => Promise<unknown>) => make({ issueComments }) };
}

beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('an issue whose search answer holds only its first comments', () => {
	it('keeps the issue as it is when the search answered every comment', async () => {
		const issueComments = pagedComments(2);
		const whole = issue([comment(1), comment(2)], 2);
		expect(await proto.withAllComments.call(withClient(issueComments), {}, whole)).toBe(whole);
		expect(issueComments).not.toHaveBeenCalled();
	});

	it('reads every comment, page by page from the start, when the search answered fewer than the total', async () => {
		const issueComments = pagedComments(230);
		const read = await proto.withAllComments.call(withClient(issueComments), {}, issue([comment(1), comment(2)], 230));
		expect(issueComments.mock.calls.map(([, startAt]) => startAt)).toEqual([0, 100, 200]);
		expect(read.fields.comment?.comments.map((item) => item.id)).toEqual(Array.from({ length: 230 }, (_, index) => String(index + 1)));
		expect(read.fields.comment?.total).toBe(230);
	});

	it('stops at the cap, and at a page that answers nothing', async () => {
		const many = pagedComments(JIRA_ISSUE_COMMENTS_MAX + 500);
		const capped = await proto.withAllComments.call(withClient(many), {}, issue([comment(1)], JIRA_ISSUE_COMMENTS_MAX + 500));
		expect(capped.fields.comment?.comments).toHaveLength(JIRA_ISSUE_COMMENTS_MAX);

		const shrinking = jest.fn(async (_issueId: string, startAt: number) => ({ comments: startAt === 0 ? [comment(1), comment(2), comment(3)] : [], total: 9 }));
		const short = await proto.withAllComments.call(withClient(shrinking), {}, issue([comment(1)], 9));
		expect(short.fields.comment?.comments).toHaveLength(3);
		expect(shrinking).toHaveBeenCalledTimes(2);
	});
});

describe('an issue whose comment or attachment could not be kept', () => {
	function harness(keepDetails: (details: { failed: number }) => void) {
		const context = {
			mapping: { integrationId: 'int-1' },
			counts: { created: 0, updated: 0, skipped: 0, failed: 0 },
			details: { comments: 0, links: 0, failed: 0 },
			report: { failures: [] as Array<{ key: string; error: string }>, moreFailures: 0 }
		};
		const self = {
			applyIssue: jest.fn(async () => ({ outcome: 'updated', taskId: 'task-1' })),
			detailsContextOf: () => ({ details: context.details }),
			withAllComments: async (_holder: unknown, item: JiraIssue) => item,
			serializedDetails: async (_key: string, work: () => Promise<void>) => work(),
			issueDetails: { apply: jest.fn(async (details: { details: { failed: number } }) => keepDetails(details.details)) },
			noteFailure: jest.fn(),
			describe: (error: unknown) => String(error),
			logger: new Logger('spec')
		};
		return { context, self };
	}

	it('answers that the issue went in whole when its details were kept', async () => {
		const { context, self } = harness(() => undefined);
		expect(await proto.applyOne.call(self, context, issue([]))).toBe(true);
		expect(context.counts.updated).toBe(1);
	});

	it('answers false when a comment or attachment failed, so the import position stays at the issue', async () => {
		const { context, self } = harness((details) => {
			details.failed += 1;
		});
		expect(await proto.applyOne.call(self, context, issue([]))).toBe(false);
		// The issue itself went in (counted once, as updated); the failed detail is counted by the run's report.
		expect(context.counts.updated).toBe(1);
		expect(context.counts.failed).toBe(0);
		expect(context.details.failed).toBe(1);
	});
});
