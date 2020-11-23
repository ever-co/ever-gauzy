import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyStatisticsComponent } from './daily-statistics.component';

describe('DailyStatisticsComponent', () => {
	let component: DailyStatisticsComponent;
	let fixture: ComponentFixture<DailyStatisticsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [DailyStatisticsComponent]
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
