import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTimeLogModalComponent } from './edit-time-log-modal.component';

describe('EditTimeLogModalComponent', () => {
	let component: EditTimeLogModalComponent;
	let fixture: ComponentFixture<EditTimeLogModalComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [EditTimeLogModalComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(EditTimeLogModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
