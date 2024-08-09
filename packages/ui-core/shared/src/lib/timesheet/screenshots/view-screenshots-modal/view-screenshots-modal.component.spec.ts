import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewScreenshotsModalComponent } from './view-screenshots-modal.component';

describe('ViewScreenshotsModalComponent', () => {
	let component: ViewScreenshotsModalComponent;
	let fixture: ComponentFixture<ViewScreenshotsModalComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ViewScreenshotsModalComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ViewScreenshotsModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
