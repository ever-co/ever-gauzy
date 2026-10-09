import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimesheetLayoutComponent } from './layout.component';
import { TimesheetModule } from '../timesheet.module';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
describe('TimesheetLayoutComponent', () => {
	let component: TimesheetLayoutComponent;
	let fixture: ComponentFixture<TimesheetLayoutComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. The route (timesheet.routes.ts) gives it `data.tabsetId`; without
			// one the tab registry rejects the tabs.
			imports: [TimesheetModule],
			providers: [
				{
					provide: ActivatedRoute,
					// The component reads `snapshot.data`; the nb-tabset it renders subscribes to `params`.
					useValue: {
						snapshot: { data: { tabsetId: 'timesheet-page' }, params: {}, queryParams: {} },
						data: of({ tabsetId: 'timesheet-page' }),
						params: of({}),
						queryParams: of({})
					}
				}
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(TimesheetLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
