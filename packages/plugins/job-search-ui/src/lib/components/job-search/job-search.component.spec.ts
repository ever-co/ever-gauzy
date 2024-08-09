import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobSearchComponent } from './job-search.component';

describe('JobSearchComponent', () => {
	let component: JobSearchComponent;
	let fixture: ComponentFixture<JobSearchComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [JobSearchComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(JobSearchComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
