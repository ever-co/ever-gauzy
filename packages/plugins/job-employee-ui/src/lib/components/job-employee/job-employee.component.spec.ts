import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobEmployeeComponent } from './job-employee.component';

describe('JobEmployeeComponent', () => {
	let component: JobEmployeeComponent;
	let fixture: ComponentFixture<JobEmployeeComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [JobEmployeeComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(JobEmployeeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
