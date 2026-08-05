import type { ChangeDetectorRef } from '@angular/core';
import moment from 'moment';
import timezone from 'moment-timezone';
import { TimerRangePickerComponent } from './timer-range-picker.component';
import type { TimeZoneService } from '../../timesheet/gauzy-filters/timezone-filter/time-zone.service';

/**
 * The picker is a ControlValueAccessor with no template logic worth a TestBed: `writeValue` (read)
 * and the value `ngAfterViewInit` composes (write) are plain functions of the configured timezone.
 * Driving them directly is what lets the round trip — the thing that was broken — be asserted.
 */
describe('TimerRangePickerComponent', () => {
	/** Asia/Istanbul: +03 year-round, so it is ahead of UTC with no DST caveat to reason about. */
	const ORG_TIMEZONE = 'Asia/Istanbul';

	let component: TimerRangePickerComponent;

	const build = (currentTimeZone = ORG_TIMEZONE): TimerRangePickerComponent =>
		new TimerRangePickerComponent(
			{ detectChanges: () => undefined } as ChangeDetectorRef,
			{
				currentTimeZone
			} as TimeZoneService
		);

	beforeEach(() => {
		// Pin the "browser" zone. Without this the suite passes or fails depending on the machine it
		// runs on: the bug under test is a MISMATCH between the browser zone and the configured one,
		// so a developer in Istanbul would see every assertion here pass against the broken code.
		timezone.tz.setDefault('UTC');
		component = build();
	});

	afterEach(() => {
		timezone.tz.setDefault();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('writeValue', () => {
		// A log entered as 00:00–18:00 on 5 Aug in Asia/Istanbul (+03).
		const STORED = {
			start: new Date('2026-08-04T21:00:00.000Z'),
			end: new Date('2026-08-05T15:00:00.000Z')
		};

		it('shows the wall-clock time of the CONFIGURED zone, not the browser zone', () => {
			component.writeValue(STORED);

			expect(component.startTime).toBe('00:00');
			expect(component.endTime).toBe('18:00');
			expect(moment(component.date).format('YYYY-MM-DD')).toBe('2026-08-05');
		});

		it('never renders a start after its end (the bug that blocked saving an edit)', () => {
			component.writeValue(STORED);

			// Read in the browser's zone these instants are 21:00 and 15:00 — start after end, so the
			// dialog computed a zero period and silently refused to save.
			expect(component.startTime < component.endTime).toBe(true);
		});

		it('round-trips: the composed instants match what was written in', () => {
			component.writeValue(STORED);

			// Exactly how `ngAfterViewInit` composes the value it emits.
			const day = moment(component.date).format('YYYY-MM-DD');
			const offset = timezone.tz(day, ORG_TIMEZONE).format('Z');
			const start = new Date(`${day} ${component.startTime}${offset}`);
			const end = new Date(`${day} ${component.endTime}${offset}`);

			expect(start.toISOString()).toBe(STORED.start.toISOString());
			expect(end.toISOString()).toBe(STORED.end.toISOString());
		});

		it('takes the day from the start, so a range spanning midnight stays ordered', () => {
			// 23:00 on 5 Aug to 01:00 on 6 Aug, Istanbul time.
			component.writeValue({
				start: new Date('2026-08-05T20:00:00.000Z'),
				end: new Date('2026-08-05T22:00:00.000Z')
			});

			expect(moment(component.date).format('YYYY-MM-DD')).toBe('2026-08-05');
			expect(component.startTime).toBe('23:00');
		});

		it('zero-pads, because the picker offers HH:mm options', () => {
			// 06:05 Istanbul; the minute also snaps down to the picker's 10-minute slots.
			component.writeValue({
				start: new Date('2026-08-05T03:05:00.000Z'),
				end: new Date('2026-08-05T06:00:00.000Z')
			});

			expect(component.startTime).toBe('06:00');
		});

		it('honours an explicitly supplied offset over the configured zone', () => {
			// manage-appointment binds [timezoneOffset] from the appointment's own timezone. Note this
			// runs before ngAfterViewInit, which is exactly when Angular calls writeValue.
			component.timezoneOffset = '-05:00';
			component.writeValue(STORED);

			expect(component.startTime).toBe('16:00');
			expect(moment(component.date).format('YYYY-MM-DD')).toBe('2026-08-04');
		});

		it('keeps the exact minute for appointments, which use finer slots', () => {
			component.fromEmployeeAppointment = true;
			component.writeValue({
				start: new Date('2026-08-05T03:05:00.000Z'),
				end: new Date('2026-08-05T03:35:00.000Z')
			});

			expect(component.startTime).toBe('06:05');
			expect(component.endTime).toBe('06:35');
		});
	});
});
