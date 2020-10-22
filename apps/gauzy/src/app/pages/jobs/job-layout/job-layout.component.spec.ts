import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobLayoutComponent } from './job-layout.component';

describe('JobLayoutComponent', () => {
	let component: JobLayoutComponent;
	let fixture: ComponentFixture<JobLayoutComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [JobLayoutComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(JobLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
