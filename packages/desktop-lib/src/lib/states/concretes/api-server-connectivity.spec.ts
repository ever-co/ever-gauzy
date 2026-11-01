jest.mock('undici', () => ({
	fetch: jest.fn(),
	Agent: jest.fn((options: unknown) => ({ options }))
}));
jest.mock('../../desktop-store', () => ({
	LocalStore: { getServerUrl: jest.fn(() => 'https://api.example.com') }
}));

import { Agent, fetch } from 'undici';
import {
	API_PROBE_TIMEOUT_MS,
	CONNECTIVITY_DETECTION_BUDGET_MS,
	CONNECTIVITY_PING_INTERVAL_MS
} from '../../offline/connectivity-timing';
import { ApiServerConnectivity } from './api-server-connectivity';

/**
 * The timer probes its API every few seconds to know whether it is online (#8415 asks to notice a lost connection
 * within 30 seconds). A probe could wait 30 seconds just to connect, and without limit for an answer once connected,
 * so the first offline notice could come well after that.
 */
describe('ApiServerConnectivity', () => {
	const fetchMock = fetch as unknown as jest.Mock;
	let timeout: jest.SpyInstance;
	let quiet: jest.SpyInstance[];

	beforeEach(() => {
		fetchMock.mockReset();
		timeout = jest.spyOn(AbortSignal, 'timeout');
		quiet = [jest.spyOn(console, 'log'), jest.spyOn(console, 'error')].map((spy) =>
			spy.mockImplementation(() => undefined)
		);
	});

	afterEach(() => {
		timeout.mockRestore();
		quiet.forEach((spy) => spy.mockRestore());
	});

	it('bounds the whole probe, connecting and answering, by the probe timeout', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

		await expect(new ApiServerConnectivity().established()).resolves.toBe(true);

		expect(timeout).toHaveBeenCalledWith(API_PROBE_TIMEOUT_MS);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.example.com/api');
		expect(init.signal).toBe(timeout.mock.results[0].value);
		expect(Agent).toHaveBeenCalledWith({ connect: { timeout: API_PROBE_TIMEOUT_MS } });
	});

	it('reports no connectivity when the probe times out', async () => {
		fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

		await expect(new ApiServerConnectivity().established()).resolves.toBe(false);
	});

	it('notices a lost connection within the detection budget: the time between probes plus one probe', () => {
		expect(CONNECTIVITY_PING_INTERVAL_MS + API_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(
			CONNECTIVITY_DETECTION_BUDGET_MS
		);
		expect(CONNECTIVITY_DETECTION_BUDGET_MS).toBe(30 * 1000);
		expect(API_PROBE_TIMEOUT_MS).toBeGreaterThan(0);
	});
});
