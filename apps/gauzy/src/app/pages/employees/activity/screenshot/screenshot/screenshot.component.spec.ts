import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ScreenshotComponent } from './screenshot.component';

describe('ScreenshotComponent', () => {
	let component: ScreenshotComponent;
	let fixture: ComponentFixture<ScreenshotComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ScreenshotComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ScreenshotComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
