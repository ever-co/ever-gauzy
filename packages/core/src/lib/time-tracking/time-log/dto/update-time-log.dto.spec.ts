import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateManualTimeLogDTO } from './update-time-log.dto';

/**
 * The body of `PUT /timesheet/time-log/:id` keeps `expectedUpdatedAt` (ever-co/ever-teams#5382) through the whitelisting
 * validation the route runs, and refuses one that is no date and time.
 */
const READ_AT = '2026-11-16T10:20:30.456Z';

/**
 * The body names no organization of its own (`sentTo`), which keeps the organization membership check, and the database
 * it reads, out of this spec.
 */
const BODY = {
	sentTo: 'e0000000-0000-4000-8000-000000000001',
	startedAt: '2026-11-10T09:00:00.000Z',
	stoppedAt: '2026-11-10T10:00:00.000Z',
	employeeId: 'b0000000-0000-4000-8000-000000000001',
	isBillable: true
};

async function validated<T>(metatype: new () => T, body: object): Promise<T> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype };
	return await pipe.transform(body, metadata);
}

describe('UpdateManualTimeLogDTO.expectedUpdatedAt', () => {
	it('keeps the precondition through the whitelisting validation', async () => {
		const input = await validated(UpdateManualTimeLogDTO, { ...BODY, expectedUpdatedAt: READ_AT });

		expect(input.expectedUpdatedAt).toBe(READ_AT);
		expect(input.isBillable).toBe(true);
	});

	it('leaves it out when none is stated: the edit is written as it always was', async () => {
		const input = await validated(UpdateManualTimeLogDTO, BODY);

		expect(input.expectedUpdatedAt).toBeUndefined();
	});

	it.each(['yesterday', '2026-13-01T00:00:00Z', 1700000000000])('refuses %p with 400', async (expectedUpdatedAt) => {
		await expect(validated(UpdateManualTimeLogDTO, { ...BODY, expectedUpdatedAt })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});
