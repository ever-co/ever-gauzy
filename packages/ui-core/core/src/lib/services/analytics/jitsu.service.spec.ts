jest.mock('@gauzy/ui-config', () => ({ environment: { JITSU_BROWSER_URL: '', JITSU_BROWSER_WRITE_KEY: '' } }));
jest.mock('@jitsu/js', () => ({ jitsuAnalytics: jest.fn(), emptyAnalytics: { page: jest.fn() } }));

import { NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { JitsuService } from './jitsu.service';

/**
 * Page views of a URL that carries an emailed link's secret (the account-deletion token, a password-reset or
 * invitation token, a sign-in code) are not sent to Jitsu: the web app uses hash routing, so the token is in the
 * path, and the Jitsu client also reads `window.location` for its own page context.
 */
describe('JitsuService page views', () => {
	function track(path: string) {
		const events = new Subject<unknown>();
		const service = new JitsuService({ path: () => path } as any, { events } as any);
		const page = jest.spyOn(service, 'page').mockResolvedValue(undefined);
		service.trackPageViews();
		events.next(new NavigationEnd(1, path, path));
		return page;
	}

	it('sends an ordinary page view', () => {
		expect(track('/pages/dashboard')).toHaveBeenCalledWith('PageView', '/pages/dashboard');
	});

	it.each([
		'/auth/delete-account/confirm?token=abc123',
		'/auth/reset-password?token=abc123&email=x',
		'/auth/magic-sign-in?email=x&code=123456'
	])('does not send %s', (path) => {
		expect(track(path)).not.toHaveBeenCalled();
	});

	it('does not send a page view while the browser URL carries a token, even when the router path does not', () => {
		const before = window.location.href;
		window.history.pushState({}, '', '/#/auth/delete-account/confirm?token=abc123');
		try {
			expect(track('/pages/dashboard')).not.toHaveBeenCalled();
		} finally {
			window.history.pushState({}, '', before);
		}
	});
});
