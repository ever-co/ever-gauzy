import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobMatchingComponent } from './job-matching.component';
import { JobMatchingModule } from '../../job-matching.module';
describe('JobMatchingComponent', () => {
	let component: JobMatchingComponent;
	let fixture: ComponentFixture<JobMatchingComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [JobMatchingModule],
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
