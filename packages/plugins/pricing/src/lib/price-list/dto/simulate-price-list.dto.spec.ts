import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SimulatePriceListDTO } from './simulate-price-list.dto';

/**
 * The REST dry run reads its body through the route's own pipe options (`transform: true, whitelist: true`), so the
 * pipe is the platform's `ValidationPipe` with those options and the DTO is the real one.
 */
const VARIANT = '00000000-0000-4000-8000-000000000001';
const pipe = new ValidationPipe({ transform: true, whitelist: true });
const read = (body: Record<string, unknown>): Promise<SimulatePriceListDTO> =>
	pipe.transform(body, { type: 'body', metatype: SimulatePriceListDTO, data: '' });

describe('SimulatePriceListDTO — the REST dry run keeps the currency it prices in (review R2-G32)', () => {
	it('keeps the currency through the route whitelist', async () => {
		// The failure scenario: `currency` carried no class-validator decorator, so `whitelist` stripped it and the
		// dry run priced in no currency on every call.
		const dto = await read({ variantIds: [VARIANT], currency: 'USD', quantity: '2' });

		expect(dto.currency).toBe('USD');
		expect(dto.variantIds).toEqual([VARIANT]);
	});

	it('refuses a body with no currency, or with one that is not a three-letter code', async () => {
		await expect(read({ variantIds: [VARIANT] })).rejects.toBeInstanceOf(BadRequestException);
		await expect(read({ variantIds: [VARIANT], currency: 'DOLLAR' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(read({ variantIds: [VARIANT], currency: 'US' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(read({ variantIds: [VARIANT], currency: 840 })).rejects.toBeInstanceOf(BadRequestException);
	});
});
