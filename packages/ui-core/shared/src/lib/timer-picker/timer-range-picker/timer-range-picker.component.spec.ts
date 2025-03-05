import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimerRangePickerComponent } from './timer-range-picker.component';
import { FormsModule } from '@angular/forms';
import { NbDatepickerModule, NbIconModule } from '@nebular/theme';
import { ChangeDetectorRef } from '@angular/core';
import * as moment from 'moment';

describe('TimerRangePickerComponent', () => {
	let component: TimerRangePickerComponent;
	let fixture: ComponentFixture<TimerRangePickerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FormsModule, NbDatepickerModule, NbIconModule],
			declarations: [TimerRangePickerComponent],
			providers: [ChangeDetectorRef]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TimerRangePickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create the component', () => {
		expect(component).toBeTruthy();
	});

	describe('Input Bindings', () => {
		it('should handle maxDate input', () => {
			const maxDate = new Date(2025, 5, 1);
			component.maxDate = maxDate;
			fixture.detectChanges();
			expect(component.maxDate).toEqual(maxDate);
		});

		it('should handle minDate input', () => {
			const minDate = new Date(2020, 5, 1);
			component.minDate = minDate;
			fixture.detectChanges();
			expect(component.minDate).toEqual(minDate);
		});

		it('should handle timezoneOffset input', () => {
			const timezone = '+05:00';
			component.timezoneOffset = timezone;
			fixture.detectChanges();
			expect(component.timezoneOffset).toBe(timezone);
		});
	});

	describe('Date and Time Selection', () => {
		it('should update selected range when date and time are selected', () => {
			const startTime = '08:00:00';
			const endTime = '09:00:00';
			const selectedDate = new Date(2025, 5, 1);

			component.date = selectedDate;
			component.startTime = startTime;
			component.endTime = endTime;
			component.updateSelectedRange();

			expect(component.selectedRange.start).toEqual(
				moment(`${selectedDate.toISOString().slice(0, 10)} ${startTime}`).toDate()
			);
			expect(component.selectedRange.end).toEqual(
				moment(`${selectedDate.toISOString().slice(0, 10)} ${endTime}`).toDate()
			);
		});
	});

	describe('Event Emission', () => {
		it('should emit selectedRangeChange event on range change', () => {
			spyOn(component.selectedRangeChange, 'emit');

			const startTime = '08:00:00';
			const endTime = '09:00:00';
			const selectedDate = new Date(2025, 5, 1);

			component.date = selectedDate;
			component.startTime = startTime;
			component.endTime = endTime;

			component.updateSelectedRange();

			expect(component.selectedRangeChange.emit).toHaveBeenCalled();
		});
	});

	describe('Validation Logic', () => {
		it('should reset date to current date if it is invalid', () => {
			component.date = new Date('invalid date');

			component.validateDate();

			expect(component.date).toEqual(jasmine.any(Date));
		});
	});

	describe('ngOnDestroy', () => {
		it('should clean up subscriptions on destroy', () => {
			spyOn(component['_destroy$'], 'next');
			spyOn(component['_destroy$'], 'complete');

			component.ngOnDestroy();

			expect(component['_destroy$'].next).toHaveBeenCalled();
			expect(component['_destroy$'].complete).toHaveBeenCalled();
		});
	});
});
