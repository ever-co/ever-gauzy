import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobSearchComponent } from './job-search.component';
import { JobSearchModule } from '../../job-search.module';
describe('JobSearchComponent', () => {
	let component: JobSearchComponent;
	let fixture: ComponentFixture<JobSearchComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [JobSearchModule],
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
