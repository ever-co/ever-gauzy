import {
	buildTimeActivitiesUrl,
	isHttpUrl,
	resolveWebAppBaseUrl,
	TIME_ACTIVITIES_PATH,
	toLocalIsoDate,
	withHashRouting
} from './web-portal-url';

/**
 * The time tracker's link to the employee's time and activity in the web app (#9517), as the owner specified it:
 * `…/#/pages/employees/activity/time-activities?organizationId=…&date=<today>&date_end=<today>&unit_of_time=day&employeeId=…&is_custom_date=false`.
 * The web app's address is known for Gauzy Cloud and for the integrated or a local server only; for any other server
 * no link is offered rather than a guessed one.
 */
describe('web portal URL', () => {
	const cloudAppUrl = 'https://app.gauzy.co/#';

	describe('resolveWebAppBaseUrl', () => {
		it('is GAUZY_CLOUD_APP for Gauzy Cloud', () => {
			expect(resolveWebAppBaseUrl({ apiHost: 'https://api.gauzy.co', cloudAppUrl })).toBe(
				'https://app.gauzy.co/#'
			);
			expect(resolveWebAppBaseUrl({ apiHost: 'https://api.gauzy.co/', cloudAppUrl })).toBe(
				'https://app.gauzy.co/#'
			);
		});

		it('is the web UI of the integrated or a local server', () => {
			expect(
				resolveWebAppBaseUrl({
					apiHost: 'http://localhost:3000',
					cloudAppUrl,
					localWebAppUrl: 'http://127.0.0.1:4200'
				})
			).toBe('http://127.0.0.1:4200/#');
		});

		it('is unknown for a custom server: no guess', () => {
			expect(resolveWebAppBaseUrl({ apiHost: 'https://gauzy.example.com', cloudAppUrl })).toBeNull();
			expect(resolveWebAppBaseUrl({ apiHost: 'https://api.gauzy.co.example.com', cloudAppUrl })).toBeNull();
			expect(resolveWebAppBaseUrl({ apiHost: 'http://api.gauzy.co', cloudAppUrl })).toBeNull();
		});

		it('is unknown without a usable address', () => {
			expect(resolveWebAppBaseUrl({ apiHost: undefined, cloudAppUrl })).toBeNull();
			expect(resolveWebAppBaseUrl({ apiHost: 'https://api.gauzy.co', cloudAppUrl: '' })).toBeNull();
			expect(
				resolveWebAppBaseUrl({ apiHost: 'https://api.gauzy.co', cloudAppUrl: 'javascript:alert(1)' })
			).toBeNull();
			expect(resolveWebAppBaseUrl({ apiHost: 'x', localWebAppUrl: 'file:///etc/passwd' })).toBeNull();
		});
	});

	describe('buildTimeActivitiesUrl', () => {
		const date = new Date(2026, 2, 15, 23, 30); // 15 March 2026, late evening local time

		it("links the employee's time and activity of the day", () => {
			expect(
				buildTimeActivitiesUrl(cloudAppUrl, { organizationId: 'org-uuid', employeeId: 'employee-uuid', date })
			).toBe(
				`https://app.gauzy.co/#${TIME_ACTIVITIES_PATH}?organizationId=org-uuid&date=2026-03-15&date_end=2026-03-15` +
					'&unit_of_time=day&employeeId=employee-uuid&is_custom_date=false'
			);
		});

		it('encodes the identifiers it is given', () => {
			const url = buildTimeActivitiesUrl(cloudAppUrl, { organizationId: 'a&b=c', employeeId: 'e#1', date });

			expect(new URL(url.replace('/#/', '/')).searchParams.get('organizationId')).toBe('a&b=c');
			expect(url).toContain('employeeId=e%231');
		});

		it('is null when the web app, the organization or the employee is unknown', () => {
			expect(buildTimeActivitiesUrl(null, { organizationId: 'o', employeeId: 'e', date })).toBeNull();
			expect(buildTimeActivitiesUrl('ftp://host/#', { organizationId: 'o', employeeId: 'e', date })).toBeNull();
			expect(buildTimeActivitiesUrl(cloudAppUrl, { organizationId: '', employeeId: 'e', date })).toBeNull();
			expect(buildTimeActivitiesUrl(cloudAppUrl, { organizationId: 'o', employeeId: null, date })).toBeNull();
		});
	});

	it('toLocalIsoDate formats the local day, zero-padded', () => {
		expect(toLocalIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
		expect(toLocalIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
	});

	it('withHashRouting adds the hash route only when missing', () => {
		expect(withHashRouting('http://127.0.0.1:4200/')).toBe('http://127.0.0.1:4200/#');
		expect(withHashRouting('https://app.gauzy.co/#/')).toBe('https://app.gauzy.co/#');
		expect(withHashRouting('https://app.gauzy.co/#')).toBe('https://app.gauzy.co/#');
	});

	it('isHttpUrl accepts http(s) addresses only', () => {
		expect(isHttpUrl('https://app.gauzy.co/#')).toBe(true);
		expect(isHttpUrl('http://127.0.0.1:4200')).toBe(true);
		expect(isHttpUrl('javascript:alert(1)')).toBe(false);
		expect(isHttpUrl('file:///c:/')).toBe(false);
		expect(isHttpUrl('not a url')).toBe(false);
		expect(isHttpUrl(undefined)).toBe(false);
	});
});
