import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MyTaskDialogComponent } from './my-task-dialog.component';

describe('MyTaskDialogComponent', () => {
	let component: MyTaskDialogComponent;
	let fixture: ComponentFixture<MyTaskDialogComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [MyTaskDialogComponent],
			teardown: { destroyAfterEach: false }
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
