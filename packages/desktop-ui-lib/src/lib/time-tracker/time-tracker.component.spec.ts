import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { TimeTrackerComponent } from './time-tracker.component';
import { AuthService, AuthStrategy } from '../auth/services';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { ScreenCaptureWebRTCService } from '../electron/services/electron/screen-capture.service';
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

	/**
	 * Issue #9872: a time slot takes no image unless the main process says the organization and the employee both allow
	 * screen capture, whichever way the renderer captures: Electron's desktop capturer, or WebRTC on Wayland.
	 */
	describe('screen capture permission', () => {
		const image = 'data:image/png;base64,aW1n';
		let isWayland = false;
		let desktopCapturer: jest.SpyInstance;
		let webRtc: jest.SpyInstance;

		const timeSlot = (allowScreenshotCapture?: boolean) => ({
			displays: null,
			screenSize: { width: 1920, height: 1080 },
			activeWindow: { id: '1', index: 0 },
			allowScreenshotCapture
		});

		beforeEach(() => {
			const electron = TestBed.inject(ElectronService);
			electron.ipcRenderer = {
				invoke: jest.fn(async (channel: string) => (channel === 'GET_IS_WAYLAND' ? isWayland : undefined)),
				send: jest.fn()
			} as unknown as ElectronService['ipcRenderer'];
			desktopCapturer = jest.spyOn(electron.desktopCapturer, 'getSources').mockResolvedValue([]);
			webRtc = jest
				.spyOn(TestBed.inject(ScreenCaptureWebRTCService), 'takeScreenshot')
				.mockResolvedValue([{ name: 'Screen 0', display_id: '1', screenshot: image, thumbnail: image }]);
		});

		it('takes no image on Wayland when capture is not allowed', async () => {
			isWayland = true;

			expect(await component.takeScreenCapture(timeSlot(false))).toEqual([]);
			expect(webRtc).not.toHaveBeenCalled();
		});

		it("takes no image with Electron's desktop capturer when capture is not allowed", async () => {
			isWayland = false;

			expect(await component.takeScreenCapture(timeSlot(false))).toEqual([]);
			expect(desktopCapturer).not.toHaveBeenCalled();
		});

		it('takes no image when the main process did not say capture is allowed', async () => {
			isWayland = true;

			expect(await component.takeScreenCapture(timeSlot())).toEqual([]);
			expect(webRtc).not.toHaveBeenCalled();
		});

		it('captures on Wayland when capture is allowed', async () => {
			isWayland = true;
			jest.spyOn(component, 'handleLastCapture').mockResolvedValue(undefined);
			const notify = jest.spyOn(component, 'screenshotNotify').mockImplementation(() => undefined);

			const screens = await component.takeScreenCapture(timeSlot(true));

			expect(webRtc).toHaveBeenCalledTimes(1);
			expect(screens).toEqual([expect.objectContaining({ name: 'Screen 0', id: '1' })]);
			expect(notify).toHaveBeenCalled();
		});
	});
});
