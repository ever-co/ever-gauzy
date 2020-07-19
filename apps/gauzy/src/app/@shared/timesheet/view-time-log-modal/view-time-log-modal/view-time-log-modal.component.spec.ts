import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewTimeLogModalComponent } from './view-time-log-modal.component';

describe('ViewTimeLogModalComponent', () => {
	let component: ViewTimeLogModalComponent;
	let fixture: ComponentFixture<ViewTimeLogModalComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ViewTimeLogModalComponent]
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
