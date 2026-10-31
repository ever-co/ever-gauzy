import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { TimeTrackerComponent } from './time-tracker.component';
import { AuthService, AuthStrategy } from '../auth/services';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { Store } from '../services';
import { ConnectivityNotifierService } from './connectivity';
import { WebPortalService } from './web-portal';
describe('TimeTrackerComponent', () => {
	let component: TimeTrackerComponent;
	let fixture: ComponentFixture<TimeTrackerComponent>;
	const webPortalUrl$ = new BehaviorSubject<string | null>(null);
	const webPortal = {
		baseUrl$: webPortalUrl$.asObservable(),
		refresh: jest.fn(async () => undefined),
		openTimeActivities: jest.fn(async () => true)
	};
	beforeEach(async () => {
		webPortalUrl$.next(null);
		webPortal.openTimeActivities.mockClear();
		await TestBed.configureTestingModule({
			imports: [TimeTrackerComponent],
			// The desktop apps provide AuthStrategy, AuthService and this library's GAUZY_ENV (the web
			// environment plus their own flags) at bootstrap (apps/desktop/src/main.ts).
			providers: [
				AuthStrategy,
				AuthService,
				{ provide: GAUZY_ENV, useValue: environment },
				{ provide: WebPortalService, useValue: webPortal }
			]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(TimeTrackerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/** The footer's link to the employee's time and activity in the web app (#9517). */
	describe('web app link', () => {
		const link = (): HTMLElement | null => fixture.nativeElement.querySelector('nb-layout-footer [role="link"]');

		beforeEach(() => {
			component.userData = { name: 'Jane Doe', employee: { id: 'employee-1' } };
		});

		it('is hidden while the web app address is unknown (a custom server)', () => {
			fixture.detectChanges();

			expect(link()).toBeNull();
		});

		it('opens the time and activity of the signed-in employee', () => {
			jest.spyOn(TestBed.inject(Store), 'organizationId', 'get').mockReturnValue('org-1');
			webPortalUrl$.next('https://app.gauzy.co/#');
			fixture.detectChanges();

			expect(link()).not.toBeNull();
			link().click();

			expect(webPortal.openTimeActivities).toHaveBeenCalledWith('org-1', 'employee-1');
		});
	});

	/** A change of connectivity is told to the user, then recorded (#8415). */
	it('notifies a change of connectivity with the entries waiting to sync', async () => {
		const notify = jest
			.spyOn(TestBed.inject(ConnectivityNotifierService), 'notify')
			.mockImplementation(() => undefined);

		(component as unknown as { _setOffline(isOffline: boolean): void })._setOffline(true);

		expect(notify).toHaveBeenCalledWith(false, true, 0);
		await expect(firstValueFrom(component.isOffline$)).resolves.toBe(true);
	});
});
