import { ComponentFixture, TestBed } from '@angular/core/testing';

import { i4netRangePickerComponent } from './gauzy-filters.component';

describe('i4netRangePickerComponent', () => {
	let component: i4netRangePickerComponent;
	let fixture: ComponentFixture<i4netRangePickerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [i4netRangePickerComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(i4netRangePickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
