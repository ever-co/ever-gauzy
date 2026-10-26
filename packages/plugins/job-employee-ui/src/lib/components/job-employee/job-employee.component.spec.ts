import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobEmployeeComponent } from './job-employee.component';
import { JobEmployeeModule } from '../../job-employee.module';
import { EmployeesService } from '@gauzy/ui-core/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
describe('JobEmployeeComponent', () => {
	let component: JobEmployeeComponent;
	let fixture: ComponentFixture<JobEmployeeComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it. EmployeesService is provided by the host
			// feature modules in the app.
			imports: [JobEmployeeModule],
			providers: [
				EmployeesService,
				{
					provide: ActivatedRoute,
					// What job-employee.routes.ts gives the page: its tabset and data-table ids.
					useValue: {
						snapshot: {
							data: { tabsetId: 'job-employee', dataTableId: 'job-employee-page' },
							params: {},
							queryParams: {}
						},
						data: of({ tabsetId: 'job-employee', dataTableId: 'job-employee-page' }),
						params: of({}),
						queryParams: of({})
					}
				}
			],
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
