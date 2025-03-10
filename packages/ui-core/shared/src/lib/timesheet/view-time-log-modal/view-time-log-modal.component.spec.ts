import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ViewTimeLogModalComponent } from './view-time-log-modal.component';

describe('ViewTimeLogModalComponent', () => {
	let component: ViewTimeLogModalComponent;
	let fixture: ComponentFixture<ViewTimeLogModalComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ViewTimeLogModalComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ViewTimeLogModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
