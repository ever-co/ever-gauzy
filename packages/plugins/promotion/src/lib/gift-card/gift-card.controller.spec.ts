// cspell:ignore EFGH JKMN
import { DEFAULT_COUPON_FORMAT } from '../coupon/coupon.service';
import { GiftCardController } from './gift-card.controller';

/**
 * R2-G30: `POST /gift-cards` without a `code` failed on the column's NOT NULL, while `issueGiftCard` minted one. The
 * route now mints it with the same generator and format, and hands a stated code through untouched.
 */
describe('GiftCardController.create — a card issued without a code is given one (R2-G30)', () => {
	function controllerUnderTest() {
		const issued: Array<Record<string, unknown>> = [];
		const giftCardService = {
			issue: jest.fn(async (input: Record<string, unknown>) => {
				issued.push(input);

				return { id: 'gc-1', ...input };
			})
		};
		const couponService = { generateCode: jest.fn(() => 'ABCD-EFGH-JKMN') };

		return {
			issued,
			couponService,
			controller: new GiftCardController(giftCardService as never, couponService as never)
		};
	}

	it.each([undefined, '', '   '])('mints a code when the body states %p', async (code) => {
		const { controller, issued, couponService } = controllerUnderTest();

		await controller.create({ initialAmount: '25', currency: 'USD', code, pin: '1234' } as never);

		expect(couponService.generateCode).toHaveBeenCalledWith(DEFAULT_COUPON_FORMAT);
		expect(issued[0]).toMatchObject({ code: 'ABCD-EFGH-JKMN', initialAmount: '25', currency: 'USD', pin: '1234' });
	});

	it('keeps the code the body states', async () => {
		const { controller, issued, couponService } = controllerUnderTest();

		await controller.create({ initialAmount: '25', currency: 'USD', code: 'GC-OWN' } as never);

		expect(couponService.generateCode).not.toHaveBeenCalled();
		expect(issued[0]).toMatchObject({ code: 'GC-OWN' });
	});
});
