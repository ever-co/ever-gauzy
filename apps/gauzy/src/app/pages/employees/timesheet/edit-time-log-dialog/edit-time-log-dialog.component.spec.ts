import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTimeLogDialogComponent } from './edit-time-log-dialog.component';

describe('EditTimeLogDialogComponent', () => {
	let component: EditTimeLogDialogComponent;
	let fixture: ComponentFixture<EditTimeLogDialogComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [EditTimeLogDialogComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(EditTimeLogDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
