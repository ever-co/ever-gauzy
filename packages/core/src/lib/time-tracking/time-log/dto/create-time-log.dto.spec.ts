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
