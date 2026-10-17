/**
 * Q7-W1c — the redemption half of the promotion engine, as an order's checkout and cancellation reach it.
 *
 * The two services are doubled at their module boundary: what is pinned is how the adapter translates
 * the order's three moments into the engine's calls, and how a reached limit is answered.
 */
jest.mock('../promotion/promotion.service', () => ({ PromotionService: class {} }));
jest.mock('../promotion-usage/promotion-usage.service', () => ({ PromotionUsageService: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PromotionUsageStatus } from '../promotion.types';
import { PromotionOrderUsageAdapter } from './promotion-order-usage.adapter';

function fixture() {
	const promotionService = {
		reserveUsage: jest.fn(async (input: any) => ({ id: 'usage-1', ...input })),
		revertUsage: jest.fn(async () => ({ reverted: '5', usage: null }))
	};
	const promotionUsageService = {
		register: jest.fn(async () => [{ id: 'usage-1' }, { id: 'usage-2' }]),
		findByOrder: jest.fn(async () => [
			{ id: 'usage-1', promotionId: 'promotion-1', status: PromotionUsageStatus.REGISTERED },
			{ id: 'usage-2', promotionId: 'promotion-2', status: PromotionUsageStatus.REVERTED }
		])
	};
	const adapter = new PromotionOrderUsageAdapter(promotionService as never, promotionUsageService as never);

	return { adapter, promotionService, promotionUsageService };
}

const reservation = {
	cartId: 'cart-1',
	promotionId: 'promotion-1',
	code: 'SPRING',
	customerId: 'customer-1',
	amount: '5',
	currency: 'USD'
};

describe('PromotionOrderUsageAdapter (Q7-W1c)', () => {
	it('reserves the use of a promotion against the cart, through the engine that counts it', async () => {
		const { adapter, promotionService } = fixture();

		await expect(adapter.reserveForCart(reservation)).resolves.toBe('usage-1');
		expect(promotionService.reserveUsage).toHaveBeenCalledWith(reservation);
	});

	it('answers a reached limit as a conflict the checkout can name', async () => {
		const { adapter, promotionService } = fixture();
		promotionService.reserveUsage.mockRejectedValueOnce(
			new BadRequestException(
				'PROMOTION_USAGE_LIMIT_EXCEEDED: promotion promotion-1 has reached its usage limit.'
			)
		);

		const refusal = adapter.reserveForCart(reservation);

		await expect(refusal).rejects.toBeInstanceOf(ConflictException);
		await expect(adapter.reserveForCart(reservation)).resolves.toBe('usage-1');
	});

	it('lets any other refusal through as it is', async () => {
		const { adapter, promotionService } = fixture();
		promotionService.reserveUsage.mockRejectedValueOnce(new Error('PROMOTION_NOT_FOUND'));

		await expect(adapter.reserveForCart(reservation)).rejects.toThrow(/PROMOTION_NOT_FOUND/);
	});

	it('registers a placed order against the reservations its cart holds', async () => {
		const { adapter, promotionUsageService } = fixture();

		await expect(adapter.registerForOrder('order-1', 'cart-1')).resolves.toBe(2);
		expect(promotionUsageService.register).toHaveBeenCalledWith('order-1', 'cart-1');
	});

	it('reverts every redemption of a cancelled order that is not reverted already', async () => {
		const { adapter, promotionService } = fixture();

		await expect(adapter.revertForOrder('order-1')).resolves.toBe(1);
		expect(promotionService.revertUsage).toHaveBeenCalledTimes(1);
		expect(promotionService.revertUsage).toHaveBeenCalledWith('promotion-1', 'order-1');
	});
});
