/**
 * The candidate list routes (`/api/candidate`, `/api/candidate-skills`, `/api/candidate-experience`,
 * `/api/candidate-educations`) validate `BaseQueryDTO`: `where` is required, and a query of flat filters was refused
 * (400 "where should not be empty"). The candidate list tools now send their filters inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerCandidateTools } from './candidates';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const CANDIDATE = '00000000-0000-4000-8000-000000000060';
const POSITION = '00000000-0000-4000-8000-000000000061';
const SOURCE = '00000000-0000-4000-8000-000000000062';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The candidate tools, by name, as a server would be handed their schemas and callbacks. */
function candidateTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerCandidateTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = candidateTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('candidate list tools — the query each route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
			if (path === `/api/candidate/${CANDIDATE}`) {
				return { id: CANDIDATE, organizationId: ORGANIZATION };
			}
			return { items: [], total: 0 };
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_candidates filters inside `where`, the search and the minimum rating outside it as before', async () => {
		await call('get_candidates', {
			status: 'HIRED',
			organizationPositionId: POSITION,
			sourceId: SOURCE,
			search: 'ada',
			rating: 3,
			page: 2,
			limit: 5,
			relations: ['user']
		});

		expect(get).toHaveBeenCalledWith('/api/candidate', {
			params: {
				where: { ...SCOPE, status: 'HIRED', organizationPositionId: POSITION, sourceId: SOURCE },
				take: 5,
				skip: 5,
				relations: ['user'],
				search: 'ada',
				rating: 3
			}
		});
	});

	it('get_candidates_by_position names the position inside `where`', async () => {
		await call('get_candidates_by_position', { positionId: POSITION });

		expect(get).toHaveBeenCalledWith('/api/candidate', {
			params: { where: { ...SCOPE, organizationPositionId: POSITION }, take: 10, skip: 0 }
		});
	});

	it.each([
		['get_candidate_skills', '/api/candidate-skills'],
		['get_candidate_experience', '/api/candidate-experience'],
		['get_candidate_education', '/api/candidate-educations']
	])('%s names the candidate inside `where`, with no page to cut its records', async (name, path) => {
		await call(name, { candidateId: CANDIDATE });

		expect(get).toHaveBeenCalledWith(path, { params: { where: { ...SCOPE, candidateId: CANDIDATE } } });
	});
});
