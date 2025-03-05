import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManualTimerPickerComponent } from './manual-timer-picker.component';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import * as moment from 'moment';
import { TranslateModule } from '@ngx-translate/core';

describe('ManualTimerPickerComponent', () => {
	let component: ManualTimerPickerComponent;
	let fixture: ComponentFixture<ManualTimerPickerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ManualTimerPickerComponent],
			imports: [FormsModule, TranslateModule.forRoot()],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();

		fixture = TestBed.createComponent(ManualTimerPickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should update value when a valid time is provided', () => {
		const validTime = '12:30:45';
		component.value = validTime;

		expect(component.value).toBe(validTime);
		expect(component.errorMessage).toBeNull();
	});

	it('should set errorMessage for invalid time format', () => {
		const invalidTime = '25:00:00';
		component.value = invalidTime;

		expect(component.errorMessage).toBe('VALIDATION.INVALID_TIME_FORMAT');
	});

	it('should correctly update value via writeValue method', () => {
		const newTime = '14:15:30';
		component.writeValue(newTime);

		expect(component.value).toBe(moment(newTime, 'HH:mm:ss').format('HH:mm:ss'));
	});

	it('should emit change event when value changes', () => {
		spyOn(component.change, 'emit');
		const validTime = '09:45:00';
		component.value = validTime;

		expect(component.change.emit).toHaveBeenCalledWith(validTime);
	});
});
