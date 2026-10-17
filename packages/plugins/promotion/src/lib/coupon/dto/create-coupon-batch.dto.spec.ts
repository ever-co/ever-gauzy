import { ValidationPipe } from '@nestjs/common';
import { CreateCouponBatchDTO } from './create-coupon-batch.dto';

/**
 * R2-G34: `POST /coupons/batch` validates its body.
 *
 * The route typed its body as an intersection (`CreateCouponDTO & { count; couponCodeFormat }`), which is
 * not a class, so the validation pipe had no metatype to validate against and the body reached the service
 * as it came. The cases run the body through the pipe the route now declares — `transform` and
 * `whitelist`, exactly as the controller's other writes — and check what reaches the handler.
 */

const pipe = new ValidationPipe({ transform: true, whitelist: true });
const run = (body: Record<string, unknown>) =>
	pipe.transform(body, { type: 'body', metatype: CreateCouponBatchDTO }) as Promise<CreateCouponBatchDTO>;

describe('CreateCouponBatchDTO — the body of POST /coupons/batch (R2-G34)', () => {
	it('accepts the documented shape and converts its wire forms', async () => {
		const batch = await run({
			promotionId: '00000000-0000-4000-8000-000000000301',
			count: '25',
			usageLimit: 1,
			startsAt: '2026-11-01T00:00:00.000Z',
			couponCodeFormat: { groupSize: 4, separator: '-', prefix: 'BF' }
		});

		expect(batch.count).toBe(25);
		expect(batch.startsAt).toBeInstanceOf(Date);
		expect(batch.couponCodeFormat).toMatchObject({ groupSize: 4, separator: '-', prefix: 'BF' });
	});

	it('refuses a batch without a count, or with a count out of range', async () => {
		await expect(run({ promotionId: '00000000-0000-4000-8000-000000000301' })).rejects.toBeDefined();
		await expect(run({ count: 0 })).rejects.toBeDefined();
		await expect(run({ count: 100001 })).rejects.toBeDefined();
		await expect(run({ count: 1.5 })).rejects.toBeDefined();
		// `Number(true)` and `Number([1])` are both 1; the shapes are refused rather than read as one code.
		await expect(run({ count: true })).rejects.toBeDefined();
		await expect(run({ count: [1] })).rejects.toBeDefined();
	});

	it('refuses a format whose group size is not a positive whole number', async () => {
		await expect(run({ count: 5, couponCodeFormat: { groupSize: 0 } })).rejects.toBeDefined();
	});

	it('strips members the route does not take instead of handing them to the service', async () => {
		const batch = (await run({
			count: 5,
			id: '00000000-0000-4000-8000-000000000999',
			usageCount: 7,
			isActive: false,
			unknown: 'value'
		})) as unknown as Record<string, unknown>;

		expect(batch.id).toBeUndefined();
		expect(batch.usageCount).toBeUndefined();
		// The coupon's own active switch: admitted, it would be spread onto every generated row.
		expect(batch.isActive).toBeUndefined();
		expect(batch.unknown).toBeUndefined();
	});

	it('does not require an organization in the body, which the unvalidated route never did', async () => {
		// The service writes every code into the caller's own scope; the base DTO's "organization or
		// organizationId" rule would have refused the request the route accepted before.
		await expect(run({ count: 5 })).resolves.toMatchObject({ count: 5 });
		await expect(run({ count: 5, organizationId: '00000000-0000-4000-8000-000000000002' })).resolves.toMatchObject({
			count: 5
		});
	});

	it('still accepts a code, which a batch never reads', async () => {
		await expect(run({ count: 5, code: 'IGNORED' })).resolves.toMatchObject({ count: 5 });
	});
});
