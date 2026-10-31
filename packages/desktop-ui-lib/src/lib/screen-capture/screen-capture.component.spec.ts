import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CLOSE_SCREEN_CAPTURE_NOTIFICATION, ScreenCaptureComponent } from './screen-capture.component';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
describe('ScreenCaptureComponent', () => {
	let component: ScreenCaptureComponent;
	let fixture: ComponentFixture<ScreenCaptureComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ScreenCaptureComponent],
			// The desktop apps provide this library's GAUZY_ENV token as the web environment plus their own
			// flags (apps/desktop/src/main.ts). The web environment is enough for a render.
			providers: [{ provide: GAUZY_ENV, useValue: environment }]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(ScreenCaptureComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	// The notification could only be waited out (#7643)
	it('asks the main process to hide the notification when its close button is clicked', () => {
		const send = jest.spyOn(TestBed.inject(ElectronService).ipcRenderer, 'send');
		const button = fixture.debugElement.query(By.css('button.notification-close'));

		expect(button.attributes['type']).toBe('button');
		expect(button.attributes['aria-label']).toBeTruthy();
		button.nativeElement.click();

		expect(send).toHaveBeenCalledWith(CLOSE_SCREEN_CAPTURE_NOTIFICATION);
		expect(CLOSE_SCREEN_CAPTURE_NOTIFICATION).toBe('close_screen_capture_notification');
	});
});
