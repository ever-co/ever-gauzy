import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AddTaskDialogComponent } from './add-task-dialog.component';

describe('AddTaskDialogComponent', () => {
	let component: AddTaskDialogComponent;
	let fixture: ComponentFixture<AddTaskDialogComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [AddTaskDialogComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(AddTaskDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
