// Must stay first: loads the entity graph before the entity is used.
import '../../core/entities/internal';

import { ApiException } from '../../core/errors/api-exception';
import { TimeLog } from './time-log.entity';
import {
	assertTimeLogUnchangedSince,
	isTimeLogUnchangedSince,
	TIME_LOG_CHANGED,
	timeLogChangedException,
	timeLogExpectedUpdatedAtOf,
	updatedAtPast,
	withoutPrecondition
} from './time-log-precondition';

/** The precondition of a time entry edit (ever-co/ever-teams#5382), apart from the database. */
describe('time-log-precondition', () => {
	describe('timeLogExpectedUpdatedAtOf', () => {
		it.each([undefined, null, ''])('reads %p as no precondition', (value) => {
			expect(timeLogExpectedUpdatedAtOf(value)).toBeNull();
		});

		it('reads an ISO 8601 date and time, and a Date, as the instant it names', () => {
			expect(timeLogExpectedUpdatedAtOf('2026-11-02T08:00:00.123Z')?.toISOString()).toBe(
				'2026-11-02T08:00:00.123Z'
			);
			const instant = new Date('2026-11-02T08:00:00.123Z');
			expect(timeLogExpectedUpdatedAtOf(instant)).toBe(instant);
		});

		it.each(['yesterday', '2026-13-01T00:00:00Z', 1700000000000, new Date('not a date'), {}])(
			'refuses %p with 400 rather than writing unconditionally',
			(value) => {
				expect(() => timeLogExpectedUpdatedAtOf(value)).toThrow(
					expect.objectContaining({ status: 400 }) as unknown as Error
				);
			}
		);
	});

	describe('isTimeLogUnchangedSince', () => {
		const expected = new Date('2026-11-02T08:00:00.123Z');

		it('compares to the millisecond, whatever form the ORM hands the stored value in', () => {
			expect(isTimeLogUnchangedSince(new Date('2026-11-02T08:00:00.123Z'), expected)).toBe(true);
			expect(isTimeLogUnchangedSince('2026-11-02T08:00:00.123Z', expected)).toBe(true);
			expect(isTimeLogUnchangedSince(expected.getTime(), expected)).toBe(true);
			expect(isTimeLogUnchangedSince(new Date('2026-11-02T08:00:00.124Z'), expected)).toBe(false);
		});

		it('takes an entry without a readable updatedAt as changed', () => {
			expect(isTimeLogUnchangedSince(null, expected)).toBe(false);
			expect(isTimeLogUnchangedSince(undefined, expected)).toBe(false);
			expect(isTimeLogUnchangedSince('not a date', expected)).toBe(false);
		});
	});

	describe('updatedAtPast', () => {
		afterEach(() => jest.restoreAllMocks());

		it('answers now when no value is given (a write of no time log)', () => {
			jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-16T12:00:00.000Z'));
			expect(updatedAtPast([]).toISOString()).toBe('2026-11-16T12:00:00.000Z');
		});

		it('answers now when every value given is in the past', () => {
			jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-16T12:00:00.000Z'));
			expect(updatedAtPast(['2026-11-01T00:00:00.000Z', null, undefined]).toISOString()).toBe(
				'2026-11-16T12:00:00.000Z'
			);
		});

		it('answers a millisecond past the latest value the clock has not passed', () => {
			jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-16T12:00:00.000Z'));
			const values = [new Date('2026-11-16T12:00:00.000Z'), Date.parse('2099-01-01T00:00:00.000Z'), 'x'];
			expect(updatedAtPast(values).toISOString()).toBe('2099-01-01T00:00:00.001Z');
		});
	});

	describe('the refusal of a stale edit', () => {
		const entry = () =>
			Object.assign(new TimeLog(), {
				id: 'entry',
				description: 'meanwhile',
				updatedAt: new Date('2030-01-01T12:00:00.000Z'),
				// A column the API keeps out of its answers
				payRateValue: 42
			});

		it('is a 409 CONCURRENT_MODIFICATION with both instants and the entry as an answer sends it', () => {
			const error = timeLogChangedException(entry(), new Date('2026-11-02T08:00:00.000Z'));

			expect(error).toBeInstanceOf(ApiException);
			expect(error.getStatus()).toBe(409);
			expect(error.code).toBe('CONCURRENT_MODIFICATION');
			expect(error.message).toBe(TIME_LOG_CHANGED);
			expect(error.details).toMatchObject({
				expectedUpdatedAt: '2026-11-02T08:00:00.000Z',
				actualUpdatedAt: '2030-01-01T12:00:00.000Z',
				timeLog: { id: 'entry', description: 'meanwhile' }
			});
			expect(error.details?.timeLog).not.toHaveProperty('payRateValue');
		});

		it('is raised only for a precondition stated and no longer held', () => {
			const stored = entry();
			expect(() => assertTimeLogUnchangedSince(stored, null)).not.toThrow();
			expect(() => assertTimeLogUnchangedSince(stored, new Date('2030-01-01T12:00:00.000Z'))).not.toThrow();
			expect(() => assertTimeLogUnchangedSince(stored, new Date('2030-01-01T12:00:00.001Z'))).toThrow(
				ApiException
			);
		});
	});

	describe('withoutPrecondition', () => {
		it('leaves the precondition out of what is written, and changes nothing else', () => {
			const changes = { description: 'edited', expectedUpdatedAt: '2026-11-02T08:00:00.000Z' };

			expect(withoutPrecondition(changes)).toEqual({ description: 'edited' });
			expect(changes).toHaveProperty('expectedUpdatedAt');
		});

		it('answers changes without a precondition as they are', () => {
			const changes = { description: 'edited' };

			expect(withoutPrecondition(changes)).toBe(changes);
		});
	});
});
