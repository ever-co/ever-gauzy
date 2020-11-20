import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeesComponent } from './employees.component';

describe('EmployeesComponent', () => {
	let component: EmployeesComponent;
	let fixture: ComponentFixture<EmployeesComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [EmployeesComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(EmployeesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
