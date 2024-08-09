import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GauzyRangePickerComponent } from './gauzy-filters.component';

describe('GauzyRangePickerComponent', () => {
	let component: GauzyRangePickerComponent;
	let fixture: ComponentFixture<GauzyRangePickerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [GauzyRangePickerComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(GauzyRangePickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
