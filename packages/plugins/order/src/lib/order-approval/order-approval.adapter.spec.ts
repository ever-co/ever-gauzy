/**
 * The adapter that answers the order's approval port with the platform's own approval machinery.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason the package's other suites give;
 * the decimal kernel is the real one, and the approval service is doubled with the calls the adapter makes,
 * so what the suite reads is exactly the request the adapter asks the platform to write and decide.
 */
jest.mock('@gauzy/core', () => ({
	...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
	RequestApprovalService: class {},
	TenantOrganizationBaseEntity: class {},
	RequestContext: { currentOrganizationId: () => 'organization-of-the-session' },
	versionExpectationOf: () => undefined
}));

import { BadRequestException } from '@nestjs/common';
import { ApprovalPolicyTypesStringEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { OrderApprovalAdapter } from './order-approval.adapter';

/** The approval service, as far as the adapter calls it. */
function approvalService(open: Array<{ id: string }> = []) {
	return {
		createRequestApproval: jest.fn(async (input: any) => ({ id: 'approval-1', ...input })),
		find: jest.fn(async () => open),
		updateStatusRequestApprovalByAdmin: jest.fn(async (id: string, status: number) => ({ id, status }))
	};
}

describe('OrderApprovalAdapter — the order’s approval, on the platform’s request_approval row', () => {
	it('files the request against the order as a SALES_ORDER, with the order’s value at the column’s scale', async () => {
		const service = approvalService();

		const filed = await new OrderApprovalAdapter(service as never).requestApproval({
			orderId: 'order-1',
			organizationId: 'organization-1',
			name: 'Order ORD-000123',
			// The order's total arrives as the number its column's transformer parsed.
			amount: 6.15,
			currency: 'USD',
			note: 'Please approve'
		});

		expect(filed).toEqual({ approvalId: 'approval-1' });
		expect(service.createRequestApproval).toHaveBeenCalledWith({
			name: 'Order ORD-000123',
			requestId: 'order-1',
			requestType: ApprovalPolicyTypesStringEnum.SALES_ORDER,
			amount: '6.150000',
			currency: 'USD',
			note: 'Please approve',
			organizationId: 'organization-1',
			// A zero-count request would stand approved before anybody had looked at it.
			min_count: 1
		});
	});

	it('files the request in the session’s organization when the order states none', async () => {
		const service = approvalService();

		await new OrderApprovalAdapter(service as never).requestApproval({
			orderId: 'order-1',
			name: 'Order ORD-000123',
			amount: '6.15',
			currency: 'USD'
		});

		expect(service.createRequestApproval.mock.calls[0][0]).toMatchObject({
			organizationId: 'organization-of-the-session',
			amount: '6.150000'
		});
	});

	it.each([
		[{ orderId: '' }, /ORDER_APPROVAL_ORDER_REQUIRED/],
		[{ name: '  ' }, /ORDER_APPROVAL_NAME_REQUIRED/],
		[{ currency: '' }, /ORDER_APPROVAL_CURRENCY_REQUIRED/],
		[{ amount: 'six' }, /ORDER_APPROVAL_AMOUNT_NOT_DECIMAL/],
		// A digit below the column's scale is refused rather than rounded: money is never quietly rounded.
		[{ amount: '6.1500001' }, /ORDER_APPROVAL_AMOUNT_NOT_DECIMAL/]
	])('refuses %j and writes nothing', async (override, refusal) => {
		const service = approvalService();
		const request = { orderId: 'order-1', name: 'Order ORD-000123', amount: '6.15', currency: 'USD', ...override };

		const error = await new OrderApprovalAdapter(service as never)
			.requestApproval(request as never)
			.catch((e) => e);

		expect(error).toBeInstanceOf(BadRequestException);
		expect(error.message).toMatch(refusal);
		expect(service.createRequestApproval).not.toHaveBeenCalled();
	});

	it('finds the order’s open request through the tenant-aware read, by the polymorphic pair and the requested status', async () => {
		const service = approvalService([{ id: 'approval-7' }]);

		await expect(new OrderApprovalAdapter(service as never).findOpen('order-1')).resolves.toEqual({
			approvalId: 'approval-7'
		});
		expect(service.find).toHaveBeenCalledWith({
			where: {
				requestId: 'order-1',
				requestType: ApprovalPolicyTypesStringEnum.SALES_ORDER,
				status: RequestApprovalStatusTypesEnum.REQUESTED
			}
		});

		await expect(new OrderApprovalAdapter(approvalService() as never).findOpen('order-1')).resolves.toBeNull();
	});

	it('decides every open request through the administrator’s decision path, and says how many', async () => {
		const service = approvalService([{ id: 'approval-7' }, { id: 'approval-8' }]);
		const adapter = new OrderApprovalAdapter(service as never);

		await expect(adapter.settle('order-1', true)).resolves.toBe(2);
		await expect(adapter.settle('order-1', false)).resolves.toBe(2);

		expect(service.updateStatusRequestApprovalByAdmin.mock.calls).toEqual([
			['approval-7', RequestApprovalStatusTypesEnum.APPROVED],
			['approval-8', RequestApprovalStatusTypesEnum.APPROVED],
			['approval-7', RequestApprovalStatusTypesEnum.REFUSED],
			['approval-8', RequestApprovalStatusTypesEnum.REFUSED]
		]);
	});
});
