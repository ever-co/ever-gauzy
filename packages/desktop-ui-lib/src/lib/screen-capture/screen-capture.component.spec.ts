import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ScreenCaptureComponent } from './screen-capture.component';

describe('ScreenCaptureComponent', () => {
	let component: ScreenCaptureComponent;
	let fixture: ComponentFixture<ScreenCaptureComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ScreenCaptureComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ScreenCaptureComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
