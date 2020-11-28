import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualTimeComponent } from './manual-time.component';

describe('ManualTimeComponent', () => {
	let component: ManualTimeComponent;
	let fixture: ComponentFixture<ManualTimeComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ManualTimeComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ManualTimeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
