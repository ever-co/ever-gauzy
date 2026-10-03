import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyStatisticsComponent } from './daily-statistics.component';
import { DailyStatisticsModule } from '../daily-statistics.module';
import { EmployeesService } from '@gauzy/ui-core/core';
describe('DailyStatisticsComponent', () => {
	let component: DailyStatisticsComponent;
	let fixture: ComponentFixture<DailyStatisticsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. EmployeesService is provided by the host feature module in the app.
			imports: [DailyStatisticsModule],
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(DailyStatisticsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
