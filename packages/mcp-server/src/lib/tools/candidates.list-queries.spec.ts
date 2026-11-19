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

	it('get_candidates filters inside `where`', async () => {
		await call('get_candidates', {
			status: 'HIRED',
			organizationPositionId: POSITION,
			sourceId: SOURCE,
			page: 2,
			limit: 5,
			relations: ['user']
		});

		expect(get).toHaveBeenCalledWith('/api/candidate', {
			params: {
				where: { ...SCOPE, status: 'HIRED', organizationPositionId: POSITION, sourceId: SOURCE },
				take: 5,
				skip: 5,
				relations: ['user']
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

describe('get_candidates — the search and the minimum rating the route does not apply', () => {
	const CANDIDATES = [
		{ id: 'c1', rating: 4, user: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' } },
		{ id: 'c2', rating: 2, user: { firstName: 'Ada', lastName: 'Byron', email: 'byron@example.com' } },
		{ id: 'c3', rating: 5, user: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' } },
		{ id: 'c4', user: { firstName: 'Alan', lastName: 'Turing', email: 'alan@example.com' } }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: CANDIDATES, total: CANDIDATES.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The ids of the candidates the tool answered, and its total. */
	async function answered(args: Record<string, unknown>) {
		const { items, total } = JSON.parse((await call('get_candidates', args)).content[0].text);
		return { ids: items.map(({ id }: { id: string }) => id), total };
	}

	it('keeps the candidates whose full name or email contains the search, reading their users', async () => {
		expect(await answered({ search: 'ada lovelace' })).toEqual({ ids: ['c1'], total: 1 });
		expect(await answered({ search: 'GRACE@' })).toEqual({ ids: ['c3'], total: 1 });

		expect(get).toHaveBeenCalledWith('/api/candidate', {
			params: { where: SCOPE, take: 100, skip: 0, relations: ['user'] }
		});
	});

	it('keeps the candidates rated at least the minimum, an unrated one counting as 0', async () => {
		expect(await answered({ rating: 4 })).toEqual({ ids: ['c1', 'c3'], total: 2 });
		expect(await answered({ rating: 0 })).toEqual({ ids: ['c1', 'c2', 'c3', 'c4'], total: 4 });
	});

	it('pages the candidates kept', async () => {
		expect(await answered({ search: 'example.com', page: 2, limit: 3 })).toEqual({ ids: ['c4'], total: 4 });
	});

	it('reads past a first page of 100 with no match, and answers the match of the next one', async () => {
		const others = Array.from({ length: 100 }, (_, index) => ({
			id: `other-${index}`,
			user: { firstName: 'Sam', lastName: `Rivera ${index}`, email: `sam${index}@example.com` }
		}));
		const match = { id: 'c-101', user: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' } };
		get.mockImplementation(async (_path: string, { params }: { params: { skip: number } }) => {
			if (params.skip === 0) {
				return { items: others, total: 101 };
			}
			return { items: [match], total: 101 };
		});

		expect(await answered({ search: 'lovelace' })).toEqual({ ids: ['c-101'], total: 1 });

		expect(get).toHaveBeenCalledTimes(2);
		expect(get).toHaveBeenLastCalledWith('/api/candidate', {
			params: { where: SCOPE, take: 100, skip: 100, relations: ['user'] }
		});
	});
});
