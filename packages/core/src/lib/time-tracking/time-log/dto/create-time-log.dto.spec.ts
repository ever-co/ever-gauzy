import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { TimeLogType } from '@gauzy/contracts';
import { CreateManualTimeLogDTO, manualEntryType } from './create-time-log.dto';

describe('CreateManualTimeLogDTO logType', () => {
	it('records a break asked for as a BREAK', () => {
		expect(plainToInstance(CreateManualTimeLogDTO, { logType: TimeLogType.BREAK }).logType).toBe(TimeLogType.BREAK);
	});

	it.each([TimeLogType.TRACKED, TimeLogType.IDLE, TimeLogType.RESUMED, TimeLogType.MANUAL, 'anything'])(
		'still records %s sent by hand as MANUAL, as before breaks',
		(sent) => {
			expect(plainToInstance(CreateManualTimeLogDTO, { logType: sent }).logType).toBe(TimeLogType.MANUAL);
		}
	);

	it('reads no type as MANUAL', () => {
		expect(manualEntryType(undefined)).toBe(TimeLogType.MANUAL);
	});
});

describe('CreateManualTimeLogDTO tags', () => {
	const meeting = '00000000-0000-4000-8000-0000000000a1';

	/** The errors on `tags` once the body is read as the route reads it. */
	const tagErrors = async (tags: unknown) => {
		const { validate } = await import('class-validator');
		const dto = plainToInstance(CreateManualTimeLogDTO, { tags });
		const errors = await validate(dto, { whitelist: true });
		return { dto, errors: errors.filter((error) => error.property === 'tags') };
	};

	it('keeps the tag ids the time is filed under', async () => {
		const { dto, errors } = await tagErrors([meeting]);

		expect(errors).toEqual([]);
		expect(dto.tags).toEqual([meeting]);
	});

	it('refuses a tag that is not a tag id', async () => {
		const { errors } = await tagErrors(['meeting']);

		expect(errors).toHaveLength(1);
	});
});
