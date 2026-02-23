import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JobLayoutComponent } from './job-layout.component';
describe('JobLayoutComponent', () => {
	let component: JobLayoutComponent;
	let fixture: ComponentFixture<JobLayoutComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			providers: [provideRouter([])],
			declarations: [JobLayoutComponent],
			teardown: { destroyAfterEach: false }
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
	it('should have router-outlet', () => {
		const outlet = fixture.nativeElement.querySelector('router-outlet');
		expect(outlet).toBeTruthy();
	});
	it('should have main landmark', () => {
		const main = fixture.nativeElement.querySelector('main[role="main"]');
		expect(main).toBeTruthy();
	});
});
