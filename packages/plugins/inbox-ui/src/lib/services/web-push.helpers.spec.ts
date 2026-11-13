import { base64UrlToBytes, supportsWebPush } from './web-push.helpers';

describe('web push helpers', () => {
	it('reads a base64url key, padding it as needed', () => {
		expect(Array.from(base64UrlToBytes('BPv_'))).toEqual([0x04, 0xfb, 0xff]);
		expect(Array.from(base64UrlToBytes('BA'))).toEqual([0x04]);
		expect(base64UrlToBytes('BNHkVsi8Cclc6eqRSElM_VAT1g9Eb2Pq2jSSq5MnWDXo1SntLBET8GBeB0Hqdr9NCAzkdg0BbGeiNhIJSlcjSSA')).toHaveLength(65);
	});

	it('needs a service worker, the Push API and notifications, outside the desktop shell', () => {
		const browser = { navigator: { serviceWorker: {}, userAgent: 'Mozilla/5.0 Chrome/131' } as unknown as Navigator, PushManager: class {}, Notification: class {} };
		expect(supportsWebPush(browser)).toBe(true);
		expect(supportsWebPush({ ...browser, PushManager: undefined })).toBe(false);
		expect(supportsWebPush({ ...browser, navigator: { userAgent: 'x' } as Navigator })).toBe(false);
		expect(supportsWebPush({ ...browser, navigator: { serviceWorker: {}, userAgent: 'Mozilla/5.0 Electron/38.0.0' } as unknown as Navigator })).toBe(false);
	});
});
