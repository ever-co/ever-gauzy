/**
 * `PUT /order-return-lines/:id` and `POST /order-return-lines` do not write the receipt counters (R2-G25).
 *
 * `receivedQuantity` and `damagedQuantity` are written by receiving the return, which moves the stock and
 * the order line's returned quantity with them. The line routes' DTO carried both and the routes handed
 * the body to the bare `CrudService`, so a line could be marked received with nothing having arrived. No
 * GraphQL field writes them. And a line a receipt was posted against keeps its quantities — the promise
 * `UpdateOrderReturnLineDTO` makes — so only its note and metadata may change.
 *
 * The controller is the real one over a stubbed service; `@gauzy/core` is doubled at the module boundary
 * for the reason the package's other suites give (its barrel boots the application graph).
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const decorator = () => () => undefined;

	return {
		CrudController: class CrudController {
			constructor(protected readonly crudService: unknown) {}
		},
		BaseQueryDTO: class {},
		TenantOrganizationBaseDTO: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		UseValidationPipe: decorator,
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions)
	};
});

jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));
jest.mock('./order-return-line.service', () => ({ OrderReturnLineService: class OrderReturnLineService {} }));
jest.mock('./order-return-line.entity', () => ({ OrderReturnLine: class OrderReturnLine {} }));

import { NotFoundException } from '@nestjs/common';
import { OrderReturnLineController } from './order-return-line.controller';

const LINE_ID = '00000000-0000-4000-8000-0000000000d1';

function fixture(stored: Record<string, unknown> = { receivedQuantity: '0', damagedQuantity: '0' }) {
	const line = { id: LINE_ID, quantity: '2.000000', ...stored };
	const service = {
		create: jest.fn().mockResolvedValue({ id: LINE_ID }),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(line)
	};

	return { service, controller: new OrderReturnLineController(service as any) };
}

describe('OrderReturnLineController — the receipt counters are the receiving action’s (R2-G25)', () => {
	it.each([{ receivedQuantity: '2' }, { damagedQuantity: '1' }, { receivedQuantity: '1', damagedQuantity: '1' }])(
		'refuses an update stating %o, and writes nothing',
		async (body) => {
			const { service, controller } = fixture();

			await expect(controller.update(LINE_ID, body as any)).rejects.toMatchObject({
				response: { code: 'RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY', details: { fields: Object.keys(body) } }
			});
			expect(service.update).not.toHaveBeenCalled();
		}
	);

	it('refuses a create stating a counter', async () => {
		const { service, controller } = fixture();

		await expect(
			controller.create({ returnId: 'r-1', orderLineId: 'ol-1', quantity: '1', receivedQuantity: '1' } as any)
		).rejects.toMatchObject({ response: { code: 'RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY' } });
		expect(service.create).not.toHaveBeenCalled();
	});

	it('still updates a line nothing was received against, predicated on the counters it read', async () => {
		const { service, controller } = fixture();

		await controller.update(LINE_ID, { quantity: '1', note: 'one only' } as any);

		// One statement: a receipt posted between the check and the write leaves it matching no row.
		expect(service.update).toHaveBeenCalledWith(
			{ id: LINE_ID, receivedQuantity: '0', damagedQuantity: '0' },
			{ quantity: '1', note: 'one only' }
		);
	});

	it.each([
		['the read-before-write finds no row', () => Promise.reject(new NotFoundException())],
		['the update matches no row', () => Promise.resolve({ affected: 0 })]
	])('answers 409 when a receipt lands during the update (%s)', async (_case, outcome) => {
		const { service, controller } = fixture();
		service.update.mockImplementationOnce(outcome as any);

		await expect(controller.update(LINE_ID, { quantity: '1' } as any)).rejects.toMatchObject({
			status: 409,
			response: { code: 'RETURN_LINE_RECEIVED_CONCURRENTLY' }
		});
	});

	it('lets a received line change only its note and metadata', async () => {
		const { service, controller } = fixture({ receivedQuantity: '1.000000', damagedQuantity: '0' });

		await expect(controller.update(LINE_ID, { quantity: '5' } as any)).rejects.toMatchObject({
			response: { code: 'RETURN_LINE_RECEIVED', details: { fields: ['quantity'] } }
		});
		expect(service.update).not.toHaveBeenCalled();

		await controller.update(LINE_ID, { note: 'box dented', organizationId: 'org-1' } as any);

		expect(service.update).toHaveBeenCalledWith(LINE_ID, { note: 'box dented', organizationId: 'org-1' });
	});

	it('counts a written-off unit as a posted receipt too', async () => {
		const { service, controller } = fixture({ receivedQuantity: '0', damagedQuantity: '1.000000' });

		await expect(controller.update(LINE_ID, { restock: false } as any)).rejects.toMatchObject({
			response: { code: 'RETURN_LINE_RECEIVED' }
		});
		expect(service.update).not.toHaveBeenCalled();
	});
});
