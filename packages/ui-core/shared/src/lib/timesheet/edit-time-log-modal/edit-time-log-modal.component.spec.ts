import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditTimeLogModalComponent } from './edit-time-log-modal.component';
import { EditTimeLogModalModule } from './edit-time-log-modal.module';
import { AuthService } from '@gauzy/ui-core/core';
describe('EditTimeLogModalComponent', () => {
	let component: EditTimeLogModalComponent;
	let fixture: ComponentFixture<EditTimeLogModalComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule so the template gets the forms / selector modules it uses.
			imports: [EditTimeLogModalModule],
			// Provided by PagesModule for every authenticated page in the app.
			providers: [AuthService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(EditTimeLogModalComponent);
		component = fixture.componentInstance;
		// The app always opens this modal with a `timeLog` context. With none, the form falls back to the
		// store's selected employee, and no employee is selected in a bare test store.
		component.timeLog = {
			employeeId: 'employee-1',
			startedAt: new Date('2026-01-05T09:00:00.000Z'),
			stoppedAt: new Date('2026-01-05T10:00:00.000Z')
		};
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
