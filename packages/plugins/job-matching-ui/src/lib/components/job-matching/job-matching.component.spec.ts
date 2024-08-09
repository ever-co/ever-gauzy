import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobMatchingComponent } from './job-matching.component';

describe('JobMatchingComponent', () => {
	let component: JobMatchingComponent;
	let fixture: ComponentFixture<JobMatchingComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [JobMatchingComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(JobMatchingComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
