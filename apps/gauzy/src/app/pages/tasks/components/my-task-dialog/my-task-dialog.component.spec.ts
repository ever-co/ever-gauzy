import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyTaskDialogComponent } from './my-task-dialog.component';

describe('MyTaskDialogComponent', () => {
	let component: MyTaskDialogComponent;
	let fixture: ComponentFixture<MyTaskDialogComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [MyTaskDialogComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(MyTaskDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
