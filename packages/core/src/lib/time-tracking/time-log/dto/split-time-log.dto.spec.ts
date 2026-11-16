import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SplitTimeLogDTO } from './split-time-log.dto';

/** The fields a body breaks, as the route's validation pipe reads it (`transform: true`, `whitelist: true`). */
async function refusedFields(body: Record<string, unknown>): Promise<string[]> {
	const dto = plainToInstance(SplitTimeLogDTO, body);
	const errors = await validate(dto, { whitelist: true });
	return errors.map((error) => error.property);
}

describe('SplitTimeLogDTO splitAt (CORE-26)', () => {
	it.each([
		'2026-11-16T11:00:00Z',
		'2026-11-16T11:00:00.000Z',
		'2026-11-16T12:00+01:00',
		'2026-11-16T05:30:00-05:30'
	])('takes the instant %s', async (splitAt) => {
		expect(await refusedFields({ splitAt })).toEqual([]);
		expect(plainToInstance(SplitTimeLogDTO, { splitAt }).splitAt).toEqual(new Date(splitAt));
	});

	it('reads an instant with an offset as that very moment, whatever the server time zone', () => {
		const dto = plainToInstance(SplitTimeLogDTO, { splitAt: '2026-11-16T12:00:00+01:00' });

		expect(dto.splitAt.toISOString()).toBe('2026-11-16T11:00:00.000Z');
	});

	it.each([
		['a time without its offset, which the server would read in its own zone', '2026-11-16T11:00:00'],
		['a day the month does not have, which would roll over into the next one', '2026-02-30T11:00:00Z'],
		['a date without a time', '2026-11-16'],
		['a number', 0],
		['text', 'tomorrow at eleven'],
		['nothing', null]
	])('refuses %s', async (_case, splitAt) => {
		expect(await refusedFields({ splitAt })).toEqual(['splitAt']);
	});
});
