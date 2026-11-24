/**
 * `stop_timer` can name the run it stops: the API's stop refuses (409) a `timeLogId` that is not the running log, so an
 * assistant never stops a run started elsewhere by mistake. Without it, the stop body is the one sent before.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerTimerTools } from './timer';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const TIME_LOG = '00000000-0000-4000-8000-000000000040';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodTypeAny; callback: ToolCallback };

/** The timer tools, by name, as a server would be handed their schemas and callbacks. */
function timerTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: z.ZodTypeAny }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerTimerTools(server as never);
	return tools;
}

describe('stop_timer — the run it stops', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});

	afterEach(() => jest.restoreAllMocks());

	it('sends the named run to the stop route', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: TIME_LOG } as never);
		const stop = timerTools().get('stop_timer') as RegisteredTool;

		await stop.callback({ timeLogId: TIME_LOG, description: 'Review' });

		expect(post).toHaveBeenCalledWith('/api/timesheet/timer/stop', {
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			description: 'Review',
			source: 'BROWSER',
			timeLogId: TIME_LOG
		});
	});

	it('sends the same body as before when no run is named', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: TIME_LOG } as never);
		const stop = timerTools().get('stop_timer') as RegisteredTool;

		await stop.callback({ source: 'DESKTOP', manualTimeSlot: false });

		expect(post).toHaveBeenCalledWith('/api/timesheet/timer/stop', {
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			source: 'DESKTOP',
			manualTimeSlot: false
		});
	});

	it('takes the run as an optional UUID', () => {
		const { inputSchema } = timerTools().get('stop_timer') as RegisteredTool;

		expect(inputSchema.safeParse({}).success).toBe(true);
		expect(inputSchema.safeParse({ timeLogId: TIME_LOG }).success).toBe(true);
		expect(inputSchema.safeParse({ timeLogId: 'the running one' }).success).toBe(false);
	});
});
