import { firstValueFrom } from 'rxjs';
import { ElectronService } from '../../electron/services';
import { CLOUD_API_URL_CHANNEL, LOCAL_WEB_APP_URL_CHANNEL, WebPortalService } from './web-portal.service';

/**
 * The link from the time tracker to the web app (#9517): its address is worked out per server, and only an
 * http(s) page of the employee's time and activity is ever opened in the browser.
 */
describe('WebPortalService', () => {
	/** What the main process answers on each channel (an `Error` for a channel it does not have). */
	let answers: Record<string, string | null | Error>;
	let electron: { ipcRenderer: { invoke: jest.Mock }; shell: { openExternal: jest.Mock } };
	let service: WebPortalService;

	beforeEach(() => {
		answers = { [LOCAL_WEB_APP_URL_CHANNEL]: null, [CLOUD_API_URL_CHANNEL]: 'https://api.gauzy.co' };
		electron = {
			ipcRenderer: {
				invoke: jest.fn(async (channel: string) => {
					const answer = answers[channel];
					if (answer instanceof Error) {
						throw answer;
					}
					return answer;
				})
			},
			shell: { openExternal: jest.fn(async () => undefined) }
		};
		service = new WebPortalService(electron as unknown as ElectronService, {
			GAUZY_CLOUD_APP: 'https://app.gauzy.co/#'
		});
	});

	it('links Gauzy Cloud, whose API address the main process gives, to its web app', async () => {
		await service.refresh('https://api.gauzy.co');

		await expect(firstValueFrom(service.baseUrl$)).resolves.toBe('https://app.gauzy.co/#');
		expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(LOCAL_WEB_APP_URL_CHANNEL);
		expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(CLOUD_API_URL_CHANNEL);
	});

	it('links to the web UI the main process reports it serves', async () => {
		answers[LOCAL_WEB_APP_URL_CHANNEL] = 'http://127.0.0.1:4200';

		await service.refresh('http://localhost:3000');

		await expect(firstValueFrom(service.baseUrl$)).resolves.toBe('http://127.0.0.1:4200/#');
	});

	it('offers no link for a custom server, nor when the main process cannot answer', async () => {
		await service.refresh('https://gauzy.example.com');
		await expect(firstValueFrom(service.baseUrl$)).resolves.toBeNull();

		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		answers[LOCAL_WEB_APP_URL_CHANNEL] = new Error('No handler registered');
		answers[CLOUD_API_URL_CHANNEL] = new Error('No handler registered');
		await service.refresh('https://api.gauzy.co');
		await expect(firstValueFrom(service.baseUrl$)).resolves.toBeNull();
		warn.mockRestore();
	});

	it('offers no Gauzy Cloud link without its API address, and still the local web UI', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		answers[CLOUD_API_URL_CHANNEL] = new Error('No handler registered'); // a main process without the channel

		await service.refresh('https://api.gauzy.co');
		await expect(firstValueFrom(service.baseUrl$)).resolves.toBeNull();

		answers[CLOUD_API_URL_CHANNEL] = null;
		answers[LOCAL_WEB_APP_URL_CHANNEL] = 'http://127.0.0.1:4200';
		await service.refresh('http://localhost:3000');
		await expect(firstValueFrom(service.baseUrl$)).resolves.toBe('http://127.0.0.1:4200/#');
		warn.mockRestore();
	});

	it("opens today's time and activity of the employee", async () => {
		await service.refresh('https://api.gauzy.co');

		await expect(service.openTimeActivities('org-uuid', 'employee-uuid')).resolves.toBe(true);

		const [url] = electron.shell.openExternal.mock.calls[0];
		expect(url).toMatch(
			/^https:\/\/app\.gauzy\.co\/#\/pages\/employees\/activity\/time-activities\?organizationId=org-uuid&date=\d{4}-\d{2}-\d{2}&date_end=\d{4}-\d{2}-\d{2}&unit_of_time=day&employeeId=employee-uuid&is_custom_date=false$/
		);
	});

	it('opens nothing while the web app is unknown or the employee is missing', async () => {
		await expect(service.openTimeActivities('org-uuid', 'employee-uuid')).resolves.toBe(false);

		await service.refresh('https://api.gauzy.co');
		await expect(service.openTimeActivities('org-uuid', '')).resolves.toBe(false);

		expect(electron.shell.openExternal).not.toHaveBeenCalled();
	});
});
