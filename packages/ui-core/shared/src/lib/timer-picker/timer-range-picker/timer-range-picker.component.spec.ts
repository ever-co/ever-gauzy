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

	/** A log entered as 00:00–18:00 on 5 Aug in Asia/Istanbul (+03). */
	const STORED = {
		start: new Date('2026-08-04T21:00:00.000Z'),
		end: new Date('2026-08-05T15:00:00.000Z')
	};

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

		it('round-trips: what the picker composes back equals what was written in', () => {
			component.writeValue(STORED);

			// The component's REAL composition, not a re-derivation of it: a test that rebuilds the
			// same moment/timezone calls passes no matter what the component does.
			const { start, end } = component.composeRange();

			expect(start?.toISOString()).toBe(STORED.start.toISOString());
			expect(end?.toISOString()).toBe(STORED.end.toISOString());
		});

		it('takes the day from the start, so a range spanning midnight stays ordered', () => {
			// 23:00 on 5 Aug to 01:00 on 6 Aug, Istanbul time.
			component.writeValue({
				start: new Date('2026-08-05T20:00:00.000Z'),
				end: new Date('2026-08-05T22:00:00.000Z')
			});

			expect(moment(component.date).format('YYYY-MM-DD')).toBe('2026-08-05');
			expect(component.startTime).toBe('23:00');
			expect(component.endTime).toBe('01:00');
		});
	});

	/**
	 * The e2e suite seeds each organisation with a RANDOM timezone
	 * (organization.seed.ts picks one with `faker.helpers.arrayElement(timezone.tz.names())`), which is
	 * why `timesheets.feature` behaved like a coin flip: whether it passed depended on which zone the
	 * run happened to draw. Sweeping every zone is the only way to say the spec is deterministic now
	 * rather than lucky again.
	 */
	describe('every IANA zone', () => {
		const zones = timezone.tz.names();

		it('sweeps a non-trivial number of zones', () => {
			// Guards the sweep itself: a moment-timezone install without its data file would make the
			// two tests below pass vacuously.
			expect(zones.length).toBeGreaterThan(300);
		});

		it('round-trips a 00:00-18:00 log — the range the e2e suite creates — in every zone', () => {
			const broken: string[] = [];

			for (const zone of zones) {
				const picker = build(zone);
				// The instants a log entered as 00:00-18:00 on 5 Aug in THAT zone would be stored as.
				const start = timezone.tz('2026-08-05 00:00', 'YYYY-MM-DD HH:mm', zone).toDate();
				const end = timezone.tz('2026-08-05 18:00', 'YYYY-MM-DD HH:mm', zone).toDate();

				picker.writeValue({ start, end });
				const composed = picker.composeRange();

				if (
					picker.startTime !== '00:00' ||
					picker.endTime !== '18:00' ||
					composed.start?.getTime() !== start.getTime() ||
					composed.end?.getTime() !== end.getTime()
				) {
					broken.push(`${zone} (${picker.startTime}-${picker.endTime})`);
				}
			}

			expect(broken).toEqual([]);
		});

		it('never composes an end BEFORE its start in any zone', () => {
			// The failure that made the edit unsaveable. Checked against the same fixed pair of instants
			// for every zone, so a zone ahead of UTC, behind it, or on a half-hour offset all count.
			const inverted: string[] = [];

			for (const zone of zones) {
				const picker = build(zone);
				picker.writeValue({
					start: new Date('2026-08-04T21:00:00.000Z'),
					end: new Date('2026-08-05T15:00:00.000Z')
				});
				const { start, end } = picker.composeRange();
				if (!start || !end || end.getTime() <= start.getTime()) {
					inverted.push(`${zone} (${picker.startTime}-${picker.endTime})`);
				}
			}

			expect(inverted).toEqual([]);
		});
	});

	describe('composeRange', () => {
		it('rolls the end onto the next day when it reads earlier than the start', () => {
			// The picker holds ONE date for both times, so a midnight-spanning range can only be
			// represented by putting the end on the following day. Composing both on the start's day
			// emits an end 22 hours BEFORE the start, which the modal rejects as a zero period.
			component.writeValue({
				start: new Date('2026-08-05T20:00:00.000Z'),
				end: new Date('2026-08-05T22:00:00.000Z')
			});

			const { start, end } = component.composeRange();

			expect(start.toISOString()).toBe('2026-08-05T20:00:00.000Z');
			expect(end.toISOString()).toBe('2026-08-05T22:00:00.000Z');
			expect(end.getTime()).toBeGreaterThan(start.getTime());
		});

		it('survives a DST transition inside the edited day', () => {
			// 8 Mar 2026, America/New_York: 02:00 EST jumps to 03:00 EDT. A log at 03:30 EDT is
			// -04:00, but the day's MIDNIGHT is still -05:00 — deriving one offset per day (as this
			// used to) re-saved an untouched log an hour out.
			component = build('America/New_York');
			const stored = {
				start: new Date('2026-03-08T07:30:00.000Z'), // 03:30 EDT
				end: new Date('2026-03-08T09:30:00.000Z') // 05:30 EDT
			};

			component.writeValue(stored);
			const { start, end } = component.composeRange();

			expect(component.startTime).toBe('03:30');
			expect(start.toISOString()).toBe(stored.start.toISOString());
			expect(end.toISOString()).toBe(stored.end.toISOString());
		});

		it('does NOT roll the end when a fall-back offset change inverts the pair', () => {
			// America/New_York, 1 Nov 2026: 02:00 EDT falls back to 01:00 EST, so 01:xx happens twice.
			// This is a real 30-minute log — 01:30 EDT to 02:00 EDT — but read back it renders as
			// 01:30 then 01:00, because the second instant is already on standard time.
			//
			// Treating that inversion as a midnight crossing turned half an hour into twenty-four and a
			// half, written the moment the dialog opened, with the user only editing the description.
			component = build('America/New_York');
			component.writeValue({
				start: new Date('2026-11-01T05:30:00.000Z'),
				end: new Date('2026-11-01T06:00:00.000Z')
			});

			const { start, end } = component.composeRange();

			expect(component.startTime).toBe('01:30');
			expect(component.endTime).toBe('01:00');
			// Under a day either way. The pair still reads inverted — one date and two ambiguous wall
			// clocks cannot express this range — but the dialog then shows a zero period and refuses to
			// save, which is a problem the user can see, not one written to the database behind them.
			expect(end.getTime() - start.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
		});

		it('does NOT roll the end when a spring-forward gap pushes the start past it', () => {
			// 8 Mar 2026, America/New_York: 02:00 EST jumps to 03:00 EDT, so 02:30 does not exist.
			// The picker still offers it, and moment-timezone normalises it forward to 03:30 — past an
			// end of 03:00. Rolling that produced a 23.5-hour range for a 30-minute entry.
			component = build('America/New_York');
			component.date = moment('2026-03-08', 'YYYY-MM-DD').toDate();
			component.startTime = '02:30';
			component.endTime = '03:00';

			const { start, end } = component.composeRange();

			// The pair comes back inverted — 02:30 does not exist, so it normalises past the end — and
			// the dialog then shows a zero period and refuses to save. That is the honest outcome for an
			// input the picker should not have offered. Rolling instead produced 23.5 hours, saved
			// without a murmur.
			expect(Math.abs(end.getTime() - start.getTime())).toBeLessThan(12 * 60 * 60 * 1000);
		});

		it('keeps an explicit offset exactly, even for a wall clock inside the ambient zone gap', () => {
			// manage-appointment sets BOTH [timezoneOffset] and moment's default zone. Parsing the wall
			// clock in that ambient zone first normalised 02:30 on a spring-forward day to 03:30 before
			// the offset was stamped, so the offset was kept and the time was not.
			timezone.tz.setDefault('America/New_York');
			component = build();
			component.timezoneOffset = '-05:00';
			component.date = moment('2026-03-08', 'YYYY-MM-DD').toDate();
			component.startTime = '02:30';
			component.endTime = '02:45';

			const { start, end } = component.composeRange();

			expect(start.toISOString()).toBe('2026-03-08T07:30:00.000Z');
			expect(end.toISOString()).toBe('2026-03-08T07:45:00.000Z');
		});

		it('composes each end independently, so one unreadable time does not null the other', () => {
			component.writeValue(STORED);
			component.endTime = '';

			const { start, end } = component.composeRange();

			expect(start?.toISOString()).toBe(STORED.start.toISOString());
			expect(end).toBeNull();
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
