import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyGridComponent } from './daily-grid.component';

describe('DailyGridComponent', () => {
	let component: DailyGridComponent;
	let fixture: ComponentFixture<DailyGridComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [DailyGridComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(DailyGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
