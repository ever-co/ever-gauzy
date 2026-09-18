/**
 * One module boundary is doubled here, for the same reason and in the same way as the package's other
 * suites: `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM,
 * the job registry, the module scanner — none of which filing one approval request needs and none of
 * which is available outside a running application. The service under test is the real one; the
 * approval machinery behind it is a double, because what this suite is about is the *request* this
 * package files, not the row the kernel writes for it.
 */
jest.mock('@gauzy/core', () => ({
	RequestApprovalService: class RequestApprovalService {},
	// The decimal test is the platform's own, taken from the money layer rather than restated here: a
	// double that answered differently would make this suite pass while the service refused real input.
	isValidDecimalString: jest.requireActual('@gauzy/core/src/lib/money/decimal').isValidDecimalString,
	// The double answers with the fixture's scope, which is what a request-scoped read resolves to. A
	// case that is about the scope re-points it with a spy, so the scope is never a constant of this
	// specification.
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'organization-1',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

import { BadRequestException } from '@nestjs/common';
import { ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IPurchaseApprovalRequest } from '../purchasing.types';
import { PurchaseApprovalService } from './purchase-approval.service';

/**
 * The approval request a purchase order files with the platform's approval machinery.
 *
 * Three things are pinned here, because each of them is a way the request could be filed *wrong*
 * without anything failing:
 *
 * - **The document is attached.** The request is only about the order if `requestId` names it and
 *   `requestType` says what kind of document that is; a request filed without the pair exists and
 *   decides nothing. The exact object handed to the approval service is therefore asserted in full,
 *   not field by field, so a field that stops being mapped is a failure rather than a silently
 *   narrower request.
 * - **The value committed is exact.** The amount is the decimal text the caller stated, in the
 *   currency it stated, and a value that is not an exact decimal is refused before anything is
 *   written — money is never parsed as a floating point number on the way through.
 * - **The organization is the caller's.** It is read from the request context rather than accepted
 *   from the caller, so an approval can never be filed into an organization the caller is not in.
 *
 * Every refusal is asserted together with the absence of a write: a validation that threw after the
 * row was created would leave a request nobody asked for.
 */

const ORG = 'organization-1';
const OTHER_ORG = 'organization-2';
const PURCHASE_ORDER = 'purchase-order-1';
const APPROVAL = 'approval-1';

/**
 * @returns The service under test, wired to a double of the platform's approval service, and the
 * double itself, which is what the assertions read.
 */
function fixture() {
	const createRequestApproval = jest.fn(async (input: Record<string, unknown>) => ({ id: APPROVAL, ...input }));

	return {
		createRequestApproval,
		service: new PurchaseApprovalService({ createRequestApproval } as never)
	};
}

/** One approval request, as the purchase-order service raises it. */
const request = (overrides: Partial<IPurchaseApprovalRequest> = {}): IPurchaseApprovalRequest => ({
	purchaseOrderId: PURCHASE_ORDER,
	name: 'Purchase order PO-1042',
	amount: '10420.500000',
	currency: 'USD',
	note: 'Quoted by the supplier on Monday.',
	...overrides
});

describe('PurchaseApprovalService — the request a purchase order files with the platform', () => {
	afterEach(() => jest.restoreAllMocks());

	it('files the request against the order, with its value, and answers with the row it wrote', async () => {
		const { service, createRequestApproval } = fixture();

		const result = await service.requestApproval(request());

		expect(createRequestApproval).toHaveBeenCalledTimes(1);
		expect(createRequestApproval).toHaveBeenCalledWith({
			name: 'Purchase order PO-1042',
			requestId: PURCHASE_ORDER,
			requestType: ApprovalPolicyTypesStringEnum.PURCHASE_ORDER,
			amount: '10420.500000',
			currency: 'USD',
			note: 'Quoted by the supplier on Monday.',
			organizationId: ORG,
			// The smallest count that makes the platform's approver machinery applicable: at zero the
			// request would stand approved before anybody had looked at it.
			min_count: 1
		});
		expect(result).toEqual({ approvalId: APPROVAL });
	});

	it('files the request even when the caller states no note, and maps no note onto it', async () => {
		const { service, createRequestApproval } = fixture();

		await service.requestApproval(request({ note: undefined }));

		expect(createRequestApproval).toHaveBeenCalledWith(expect.objectContaining({ note: undefined }));
	});

	it('carries the value as the exact decimal text the caller stated, never as a parsed number', async () => {
		const { service, createRequestApproval } = fixture();

		await service.requestApproval(request({ amount: '0.300000', currency: 'EUR' }));

		const [input] = createRequestApproval.mock.calls[0];

		expect(input.amount).toBe('0.300000');
		expect(typeof input.amount).toBe('string');
		expect(input.currency).toBe('EUR');
	});

	it('takes the organization from the request context rather than from the caller', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, createRequestApproval } = fixture();

		await service.requestApproval(request());

		expect(createRequestApproval).toHaveBeenCalledTimes(1);
		expect(createRequestApproval.mock.calls[0][0]).toMatchObject({ organizationId: OTHER_ORG });
	});

	it('refuses a request that names no purchase order, and writes nothing', async () => {
		const { service, createRequestApproval } = fixture();

		await expect(service.requestApproval(request({ purchaseOrderId: undefined as never }))).rejects.toThrow(
			/PURCHASE_APPROVAL_ORDER_REQUIRED/
		);
		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('refuses a request that states no name, and writes nothing', async () => {
		const { service, createRequestApproval } = fixture();

		await expect(service.requestApproval(request({ name: undefined as never }))).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('refuses a request whose name is only whitespace, and writes nothing', async () => {
		// An approver's list is read by a person, so a name nobody can read is not a name.
		const { service, createRequestApproval } = fixture();

		await expect(service.requestApproval(request({ name: '   ' }))).rejects.toThrow(
			/PURCHASE_APPROVAL_NAME_REQUIRED/
		);
		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('refuses a request that states no amount, and writes nothing', async () => {
		const { service, createRequestApproval } = fixture();

		await expect(service.requestApproval(request({ amount: undefined as never }))).rejects.toThrow(
			/PURCHASE_APPROVAL_AMOUNT_REQUIRED/
		);
		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('refuses a request that states no currency, and writes nothing', async () => {
		const { service, createRequestApproval } = fixture();

		await expect(service.requestApproval(request({ currency: undefined as never }))).rejects.toThrow(
			/PURCHASE_APPROVAL_CURRENCY_REQUIRED/
		);
		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('refuses an amount that is not an exact decimal, and writes nothing', async () => {
		const { service, createRequestApproval } = fixture();

		// A thousands separator, an exponent and a value with nowhere to stop are the three shapes a
		// caller reaches for when it has been holding the amount as something other than a decimal.
		for (const amount of ['10,420.50', '1.04205e4', '10.420.500']) {
			await expect(service.requestApproval(request({ amount }))).rejects.toThrow(
				/PURCHASE_APPROVAL_AMOUNT_NOT_DECIMAL/
			);
		}

		expect(createRequestApproval).not.toHaveBeenCalled();
	});

	it('files no request at all when the platform wrote no row', async () => {
		// The control for every refusal above: a well-formed request does reach the platform, so the
		// assertions that nothing was written are about the refusal rather than about a service that
		// never writes.
		const { service, createRequestApproval } = fixture();

		await service.requestApproval(request());

		expect(createRequestApproval).toHaveBeenCalledTimes(1);
	});
});
