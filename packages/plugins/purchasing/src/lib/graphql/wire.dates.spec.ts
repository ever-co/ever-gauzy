import { CreateGoodsReceiptLineInputDTO } from '../goods-receipt/dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDTO } from '../goods-receipt/dto/update-goods-receipt.dto';
import { UpdateGoodsReceiptLineDTO } from '../goods-receipt-line/dto/update-goods-receipt-line.dto';
import { asRouteBody } from './wire';

/**
 * A receipt's dates arrive as strings — a JSON body on REST, a `DateTime` input over GraphQL (the shared scalar
 * leaves the value as sent) — and the DTOs declared `@IsDate()` with no conversion, so every non-null
 * `receivedAt` / `expiresAt` was refused before the service saw it (Greptile on #10562).
 */
describe('goods receipt dates through the route body validation', () => {
	const at = '2026-10-14T10:00:00.000Z';

	it('accepts the receipt date of updateGoodsReceipt as a Date', async () => {
		const body = await asRouteBody(UpdateGoodsReceiptDTO, { receivedAt: at, note: 'counted twice' });

		expect(body.receivedAt).toEqual(new Date(at));
	});

	it('accepts a line expiry restated beside a note on updateGoodsReceiptLine', async () => {
		const body = await asRouteBody(UpdateGoodsReceiptLineDTO, { expiresAt: at, note: 'two cartons dented' });

		expect(body.expiresAt).toEqual(new Date(at));
	});

	it('still refuses a value that is not a date', async () => {
		await expect(asRouteBody(UpdateGoodsReceiptDTO, { receivedAt: 'yesterday' })).rejects.toMatchObject({
			status: 400
		});
	});

	it('converts the expiry of a line recorded with a receipt', async () => {
		const line = await asRouteBody(CreateGoodsReceiptLineInputDTO, {
			purchaseOrderLineId: '00000000-0000-4000-8000-000000000002',
			quantity: '1',
			expiresAt: at
		});

		expect(line.expiresAt).toEqual(new Date(at));
	});
});
