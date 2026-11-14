import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { MoveTimerStartDTO } from './move-timer-start.dto';

/**
 * The body of `PUT /timesheet/timer/started-at`, through the pipe the route mounts: a start, as a date, and an
 * optional reason that fits a time log. Anything else is dropped, so a client sending its usual tenant and
 * organization ids is not refused for them.
 */
describe('MoveTimerStartDTO', () => {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype: MoveTimerStartDTO };

	const validate = (body: Record<string, unknown>) => pipe.transform(body, metadata);

	it('takes the start as a date and keeps the reason', async () => {
		const dto = await validate({ startedAt: '2026-11-16T09:00:00.000Z', reason: 'Forgot to start timer' });

		expect(dto.startedAt).toBeInstanceOf(Date);
		expect(dto.startedAt.toISOString()).toBe('2026-11-16T09:00:00.000Z');
		expect(dto.reason).toBe('Forgot to start timer');
	});

	it('takes a body without a reason', async () => {
		const dto = await validate({ startedAt: '2026-11-16T09:00:00.000Z' });

		expect(dto.reason).toBeUndefined();
	});

	it('drops the members it does not declare', async () => {
		const dto = await validate({
			startedAt: '2026-11-16T09:00:00.000Z',
			tenantId: 'tenant',
			organizationId: 'organization',
			isRunning: false
		});

		expect(dto).not.toHaveProperty('tenantId');
		expect(dto).not.toHaveProperty('organizationId');
		expect(dto).not.toHaveProperty('isRunning');
	});

	it.each([
		['no start', {}],
		['a start that is not a date', { startedAt: 'nine o clock' }],
		['a reason that is not a string', { startedAt: '2026-11-16T09:00:00.000Z', reason: 42 }],
		['a reason longer than a time log keeps', { startedAt: '2026-11-16T09:00:00.000Z', reason: 'x'.repeat(256) }]
	])('refuses %s', async (_case, body) => {
		await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
	});
});
