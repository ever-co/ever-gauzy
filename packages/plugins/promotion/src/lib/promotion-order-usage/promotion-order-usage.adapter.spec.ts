/**
 * Q7-W1c — the redemption half of the promotion engine, as an order's checkout and cancellation reach it.
 *
 * The two services are doubled at their module boundary: what is pinned is how the adapter translates
 * the order's three moments into the engine's calls, and how a reached limit is answered.
 */
jest.mock('../promotion/promotion.service', () => ({
	PromotionService: class {},
	PROMOTION_USAGE_LIMIT_EXCEEDED: 'PROMOTION_USAGE_LIMIT_EXCEEDED'
}));
jest.mock('../promotion-usage/promotion-usage.service', () => ({ PromotionUsageService: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PromotionUsageStatus } from '../promotion.types';
import { PromotionOrderUsageAdapter } from './promotion-order-usage.adapter';

function fixture(options: { perCustomer?: number; held?: boolean; used?: number } = {}) {
	const promotionService = {
		reserveUsage: jest.fn(async (input: any) => ({ id: 'usage-1', ...input })),
		findPromotionOrFail: jest.fn(async (id: string) => ({ id, perCustomerUsageLimit: options.perCustomer })),
		releaseCartUsage: jest.fn(async () => [{ id: 'usage-1' }]),
		revertUsage: jest.fn(async () => ({ reverted: '5', usage: null }))
	};
	const promotionUsageService = {
		register: jest.fn(async () => [{ id: 'usage-1' }, { id: 'usage-2' }]),
		hasLiveReservation: jest.fn(async () => options.held ?? false),
		countByCustomer: jest.fn(async () => options.used ?? 0),
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

describe('PromotionOrderUsageAdapter — the per-customer limit and a failed checkout (Greptile on #10897)', () => {
	it('refuses a customer who has used a once-per-customer promotion on another order', async () => {
		const { adapter, promotionService } = fixture({ perCustomer: 1, used: 1 });

		await expect(adapter.reserveForCart(reservation)).rejects.toMatchObject({
			response: { code: 'PROMOTION_CUSTOMER_LIMIT_REACHED' }
		});
		expect(promotionService.reserveUsage).not.toHaveBeenCalled();
	});

	it("does not count the cart's own live reservation against the customer", async () => {
		const { adapter } = fixture({ perCustomer: 1, used: 1, held: true });

		await expect(adapter.reserveForCart(reservation)).resolves.toBe('usage-1');
	});

	it('releases what a failed checkout reserved', async () => {
		const { adapter, promotionService } = fixture();

		await expect(adapter.releaseForCart('cart-1')).resolves.toBe(1);
		expect(promotionService.releaseCartUsage).toHaveBeenCalledWith('cart-1');
	});
});

describe('PromotionOrderUsageAdapter — the refusal shape and a partial revert (CodeRabbit on #10897)', () => {
	it('reads the limit refusal by the code the engine states, whatever its text', async () => {
		const { adapter, promotionService } = fixture();
		// The shape `PromotionService.reserveUsage` throws: a stable code beside the message.
		promotionService.reserveUsage.mockRejectedValueOnce(
			new BadRequestException({ message: 'reworded', code: 'PROMOTION_USAGE_LIMIT_EXCEEDED' })
		);

		await expect(adapter.reserveForCart(reservation)).rejects.toMatchObject({
			response: { code: 'PROMOTION_USAGE_LIMIT_REACHED' }
		});
	});

	it('attempts every redemption of a cancelled order and reports the ones refused together', async () => {
		const { adapter, promotionService, promotionUsageService } = fixture();
		promotionUsageService.findByOrder.mockResolvedValueOnce([
			{ id: 'u-1', promotionId: 'promotion-1', status: PromotionUsageStatus.REGISTERED },
			{ id: 'u-2', promotionId: 'promotion-2', status: PromotionUsageStatus.REGISTERED }
		] as never);
		promotionService.revertUsage.mockRejectedValueOnce(new Error('store down'));

		await expect(adapter.revertForOrder('order-1')).rejects.toThrow(
			/PROMOTION_USAGE_REVERT_INCOMPLETE.*1 reverted, 1 refused/
		);
		expect(promotionService.revertUsage).toHaveBeenCalledTimes(2);
	});
});
