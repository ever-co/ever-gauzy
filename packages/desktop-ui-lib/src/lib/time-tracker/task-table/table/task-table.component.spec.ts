import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskTableComponent } from './task-table.component';
import { IUser } from '@gauzy/contracts';
import { Store } from '../../../services';
describe('TaskTableComponent', () => {
	let component: TaskTableComponent;
	let fixture: ComponentFixture<TaskTableComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TaskTableComponent]
		}).compileComponents();
		// The task table only builds its data source for a signed-in employee in an organization, which the
		// time tracker always has; a bare store has none, and `loading$` was read from a missing source.
		const store = TestBed.inject(Store);
		store.tenantId = 'tenant-1';
		store.organizationId = 'organization-1';
		store.user = { id: 'user-1', employee: { id: 'employee-1' } } as IUser;
		fixture = TestBed.createComponent(TaskTableComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
