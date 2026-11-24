/**
 * `update_candidate_status` and `rate_candidate` put to `/candidate/:id/status` and `/candidate/:id/rating`, which
 * land on `PUT /candidate/:id/:status`: that route hires on `hired`, rejects on `rejected`, and answers any other
 * word 202 with an empty body, so both tools reported a success while the candidate stayed as it was. The status
 * tool now calls the hire or the reject route and checks the status the API answers; the API has no route for any
 * other status, nor for a rating, and those are answered so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerCandidateTools } from './candidates';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const CANDIDATE = '00000000-0000-4000-8000-000000000091';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a candidate tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerCandidateTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

/** Spies on every request method of the API client, answering each with `answer`. */
const spyOnRequests = (answer: unknown = {}) =>
	(['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
		jest.spyOn(apiClient, method).mockResolvedValue(answer as never)
	);

describe('candidate tools: the routes they call', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ id: CANDIDATE, organizationId: ORGANIZATION } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['HIRED', 'hired'],
		['REJECTED', 'rejected']
	])('sets %s through the route that does it, in the scope the routes require', async (status, segment) => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: CANDIDATE, status } as never);

		const result = await call('update_candidate_status', { id: CANDIDATE, status });

		expect(get).toHaveBeenCalledWith(`/api/candidate/${CANDIDATE}`, { params: { ...SCOPE, where: SCOPE } });
		expect(put).toHaveBeenCalledWith(`/api/candidate/${CANDIDATE}/${segment}`, SCOPE);
		expect(JSON.parse(result.content[0].text)).toEqual({ id: CANDIDATE, status });
	});

	it('reports a failure, not a success, when the API answers without the new status', async () => {
		jest.spyOn(apiClient, 'put').mockResolvedValue('' as never);

		await expect(call('update_candidate_status', { id: CANDIDATE, status: 'HIRED' })).rejects.toThrow(
			"The API left the candidate's status unchanged instead of setting HIRED."
		);
	});

	it.each(['APPLIED', 'INTERVIEW', 'ON_HOLD'])('refuses to set %s, without any request', async (status) => {
		const requests = spyOnRequests();

		await expect(call('update_candidate_status', { id: CANDIDATE, status })).rejects.toThrow(
			`This server does not offer setting a candidate's status to ${status}`
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it('answers that rating a candidate is not offered, without any request', async () => {
		const requests = spyOnRequests();

		await expect(call('rate_candidate', { id: CANDIDATE, rating: 4 })).rejects.toThrow(
			'This server does not offer rating a candidate'
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
