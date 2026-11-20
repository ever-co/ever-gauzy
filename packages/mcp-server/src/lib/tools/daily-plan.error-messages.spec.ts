/**
 * A failed daily plan tool answered the assistant with the error and its whole stack: the folder the server runs from,
 * and the files and lines of its libraries (#12103). Every daily plan tool now answers with the message alone, as the
 * other tool groups do, and the server's log keeps the stack.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { Logger } from '@nestjs/common';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerDailyPlanTools } from './daily-plan';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};
const TEAM = '00000000-0000-4000-8000-000000000010';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const TASK = '00000000-0000-4000-8000-000000000030';
const PLAN = '00000000-0000-4000-8000-000000000040';
const NEW_PLAN = {
	date: '2026-11-20',
	workTimePlanned: 4,
	status: 'open',
	organizationTeamId: TEAM,
	employeeId: EMPLOYEE
};

/** The API client's own failure, whose stack runs through the HTTP library's files. */
const API_FAILURE = 'Request failed with status code 400';

/** Arguments that take each tool that calls the API as far as its request. */
const ARGUMENTS_REACHING_THE_API: Record<string, Record<string, unknown>> = {
	get_daily_plans: {},
	get_my_daily_plans: {},
	get_team_daily_plans: { organizationTeamId: TEAM },
	get_employee_daily_plans: { employeeId: EMPLOYEE },
	get_daily_plans_for_task: { taskId: TASK },
	get_daily_plan: { id: PLAN },
	create_daily_plan: { daily_plan_data: NEW_PLAN },
	update_daily_plan: { id: PLAN, plan_data: { status: 'completed' } },
	delete_daily_plan: { id: PLAN },
	add_task_to_daily_plan: { planId: PLAN, taskId: TASK, employeeId: EMPLOYEE },
	remove_task_from_daily_plan: { planId: PLAN, taskId: TASK, employeeId: EMPLOYEE },
	remove_task_from_many_daily_plans: { taskId: TASK, employeeId: EMPLOYEE },
	get_daily_plan_count: {},
	bulk_create_daily_plans: { plans: [NEW_PLAN] },
	bulk_update_daily_plans: { plans: [{ ...NEW_PLAN, id: PLAN }] },
	bulk_delete_daily_plans: { ids: [PLAN] }
};

/** The tool the API offers nothing for: it refuses without a request. */
const NOT_OFFERED_TOOL = 'get_daily_plan_statistics';

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;

/** Every daily plan tool's callback, by name, as a server would be handed them. */
function dailyPlanCallbacks(): Map<string, ToolCallback> {
	const callbacks = new Map<string, ToolCallback>();
	const server = {
		registerTool: (name: string, _config: unknown, callback: ToolCallback) => callbacks.set(name, callback)
	};
	registerDailyPlanTools(server as never);
	return callbacks;
}

/** A line of a stack trace: `at <function> (<file>:<line>:<column>)`. */
const STACK_FRAME = /\n\s+at .+:\d+:\d+/;

const API_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** What a tool's callback ended with: the error it threw, or none. */
async function failureOf(callback: ToolCallback, args: Record<string, unknown>): Promise<Error | undefined> {
	try {
		await callback(args);
		return undefined;
	} catch (error) {
		return error as Error;
	}
}

describe('daily plan tools: what a failure tells the assistant', () => {
	const callbacks = dailyPlanCallbacks();
	const requests: jest.SpyInstance[] = [];
	let logged: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		requests.length = 0;
		for (const method of API_METHODS) {
			requests.push(jest.spyOn(apiClient, method).mockRejectedValue(new Error(API_FAILURE)));
		}
		logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	const loggedText = () => logged.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
	const requestCount = () => requests.reduce((count, request) => count + request.mock.calls.length, 0);

	it('covers every daily plan tool', () => {
		const covered = [...Object.keys(ARGUMENTS_REACHING_THE_API), NOT_OFFERED_TOOL].sort();

		expect(covered).toEqual([...callbacks.keys()].sort());
	});

	it.each(Object.entries(ARGUMENTS_REACHING_THE_API))(
		"%s answers the API's failure without its stack, which stays in the log",
		async (name, args) => {
			const failure = await failureOf(callbacks.get(name) as ToolCallback, args);

			expect(requestCount()).toBeGreaterThan(0);
			expect(failure?.message).toMatch(/^Failed to /);
			expect(failure?.message).toContain(API_FAILURE);
			expect(failure?.message).not.toMatch(STACK_FRAME);
			expect(loggedText()).toMatch(/at .+:\d+:\d+/);
		}
	);

	it(`${NOT_OFFERED_TOOL} says the API offers it nothing, without a stack and without a request`, async () => {
		const failure = await failureOf(callbacks.get(NOT_OFFERED_TOOL) as ToolCallback, {});

		expect(requestCount()).toBe(0);
		expect(failure?.message).toMatch(/^Failed to fetch daily plan statistics: /);
		expect(failure?.message).not.toMatch(STACK_FRAME);
		expect(loggedText()).toMatch(/at .+:\d+:\d+/);
	});
});
