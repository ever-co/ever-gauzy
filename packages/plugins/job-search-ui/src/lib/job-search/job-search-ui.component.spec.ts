import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobSearchUiComponent } from './job-search-ui.component';

describe('JobSearchUiComponent', () => {
	let component: JobSearchUiComponent;
	let fixture: ComponentFixture<JobSearchUiComponent>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			declarations: [JobSearchUiComponent]
		});
		fixture = TestBed.createComponent(JobSearchUiComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
