import { environment } from '@gauzy/ui-config';
import { everIdSignInLink, isEverIdSettingsVisible, resetEverIdUiState } from './ever-id-ui.state';

describe('Connected identities menu entry', () => {
	const saved = environment.ZITADEL_AUTH_LINK;
	let fetchSpy: jest.SpyInstance;

	beforeEach(() => {
		resetEverIdUiState();
		if (typeof globalThis.fetch !== 'function') {
			// jsdom has no fetch; the spy below replaces this placeholder.
			(globalThis as { fetch?: unknown }).fetch = () => Promise.reject(new Error('fetch not available'));
		}
		fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
			ok: true,
			json: async () => ({ enabled: true })
		} as never);
	});

	afterEach(() => {
		environment.ZITADEL_AUTH_LINK = saved;
		fetchSpy.mockRestore();
	});

	it('stays hidden and asks nothing while no Ever ID sign-in link is configured', () => {
		environment.ZITADEL_AUTH_LINK = '';
		expect(isEverIdSettingsVisible()).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('treats the Docker placeholder as unset', () => {
		environment.ZITADEL_AUTH_LINK = 'DOCKER_ZITADEL_AUTH_LINK';
		expect(everIdSignInLink()).toBe('');
		expect(isEverIdSettingsVisible()).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('asks the API once and shows the entry when Ever ID sign-in is enabled', async () => {
		environment.ZITADEL_AUTH_LINK = 'http://localhost:3000/api/auth/zitadel';
		expect(isEverIdSettingsVisible()).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isEverIdSettingsVisible()).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/api\/auth\/zitadel\/config$/);
	});

	it('keeps the entry hidden when the API answers 404', async () => {
		fetchSpy.mockResolvedValue({ ok: false, json: async () => ({}) } as never);
		environment.ZITADEL_AUTH_LINK = 'http://localhost:3000/api/auth/zitadel';
		isEverIdSettingsVisible();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isEverIdSettingsVisible()).toBe(false);
	});
});
