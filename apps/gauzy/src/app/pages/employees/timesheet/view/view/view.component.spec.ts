import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimesheetViewComponent } from './view.component';
import { ViewModule } from '../view.module';
describe('TimesheetViewComponent', () => {
	let component: TimesheetViewComponent;
	let fixture: ComponentFixture<TimesheetViewComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. (This stub imported `ViewComponent`; the file exports
			// `TimesheetViewComponent`, so it declared `undefined`.)
			imports: [ViewModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(TimesheetViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
