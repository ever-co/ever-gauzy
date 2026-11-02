import { definedValues, toUpdatePayload, warnEmptyUpdate } from './update-payload';

/**
 * Knex drops `undefined` values from an UPDATE and throws "Empty .update() call detected!" when none is left
 * (#7811). These helpers say what an update really writes, so the local database code can skip one that writes
 * nothing instead of failing the timer start.
 */
describe('update payload', () => {
	describe('definedValues', () => {
		it('drops undefined values and the primary key, keeps everything else', () => {
			const startedAt = new Date('2026-10-31T08:00:00Z');

			expect(
				definedValues({ id: 7, startedAt, synced: false, duration: 0, projectId: undefined, taskId: undefined })
			).toEqual({ startedAt, synced: false, duration: 0 });
		});

		it('keeps null: clearing a column is a real write', () => {
			expect(definedValues({ id: 7, timelogId: null, taskId: undefined })).toEqual({ timelogId: null });
		});

		it('drops the key columns it is given', () => {
			expect(definedValues({ id: 1, queue_id: 'q1', status: 'done' }, ['id', 'queue_id'])).toEqual({
				status: 'done'
			});
		});

		it('answers an empty object for a missing payload', () => {
			expect(definedValues(undefined)).toEqual({});
			expect(definedValues(null)).toEqual({});
		});

		it('does not change the object it reads', () => {
			const values = { id: 3, note: 'x', taskId: undefined };

			definedValues(values);

			expect(values).toEqual({ id: 3, note: 'x', taskId: undefined });
		});
	});

	describe('toUpdatePayload', () => {
		it('answers null when nothing is left to write', () => {
			expect(toUpdatePayload({ id: 1 })).toBeNull();
			expect(toUpdatePayload({ id: 1, projectId: undefined, taskId: undefined })).toBeNull();
			expect(toUpdatePayload({})).toBeNull();
			expect(toUpdatePayload(undefined)).toBeNull();
		});

		it('answers the values to write otherwise', () => {
			expect(toUpdatePayload({ id: 1, synced: true, taskId: undefined })).toEqual({ synced: true });
		});

		it('treats a payload that only repeats its key columns as empty', () => {
			expect(toUpdatePayload({ queue_id: 'q1' }, ['id', 'queue_id'])).toBeNull();
		});
	});

	it('warnEmptyUpdate logs a warning naming the scope and the row', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		warnEmptyUpdate('TIMERTRX', 42);

		expect(warn).toHaveBeenCalledWith(expect.stringContaining('TIMERTRX'));
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('42'));
		warn.mockRestore();
	});
});
