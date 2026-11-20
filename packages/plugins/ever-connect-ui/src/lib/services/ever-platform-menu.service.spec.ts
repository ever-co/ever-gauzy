import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { EverConnectUiService } from './ever-connect.service';
import { EVER_PLATFORM_MENU_RETRY_MS, EverPlatformMenuService } from './ever-platform-menu.service';

const PROBE = { loaded: true, managed_by: 'operator', status: 'connected', connected: true };

/** Whether Settings > Ever Platform is offered: the API's menu probe answered, asked once per signed-in user. */
describe('EverPlatformMenuService', () => {
	const api = { probe: jest.fn() };
	let user$: BehaviorSubject<{ id: string } | null>;

	function service(): EverPlatformMenuService {
		user$ = new BehaviorSubject<{ id: string } | null>({ id: 'u1' });
		TestBed.configureTestingModule({
			providers: [
				{ provide: EverConnectUiService, useValue: api },
				{ provide: Store, useValue: { user$ } }
			]
		});
		return TestBed.inject(EverPlatformMenuService);
	}

	beforeEach(() => jest.resetAllMocks());

	it('the probe answers: true', () => {
		api.probe.mockReturnValue(of(PROBE));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([true]);
	});

	// 404: the module is not loaded, or not the operator; 403 / 401: not for this user, or signed out meanwhile.
	it.each([404, 403, 401])('%i: false at once, asked once', (status) =>
		fakeAsync(() => {
			api.probe.mockReturnValue(throwError(() => ({ status })));
			const values: boolean[] = [];
			service().available$.subscribe((value) => values.push(value));
			tick(EVER_PLATFORM_MENU_RETRY_MS * 100);
			expect(values).toEqual([false]);
			expect(api.probe).toHaveBeenCalledTimes(1);
		})()
	);

	it('a temporary failure is retried', fakeAsync(() => {
		api.probe.mockReturnValueOnce(throwError(() => ({ status: 503 }))).mockReturnValue(of(PROBE));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		expect(values).toEqual([]);
		tick(EVER_PLATFORM_MENU_RETRY_MS);
		expect(values).toEqual([true]);
	}));

	it('signed out: false without asking; another user asks again', () => {
		api.probe.mockReturnValue(of(PROBE));
		const values: boolean[] = [];
		service().available$.subscribe((value) => values.push(value));
		user$.next(null);
		expect(values).toEqual([true, false]);
		user$.next({ id: 'u2' });
		expect(values).toEqual([true, false, true]);
		expect(api.probe).toHaveBeenCalledTimes(2);
	});
});
