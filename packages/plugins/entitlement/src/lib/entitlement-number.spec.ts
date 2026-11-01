import { EntitlementKind } from './entitlement.enums';
import { DERIVED_ENTITLEMENT_NUMBER_ATTEMPTS, deriveEntitlementNumber } from './entitlement-number';

/**
 * The number an event grant derives from its purchase (#11023).
 *
 * The first right of a provenance keeps the number it always carried; a later one — the line granted again
 * after its right was revoked — takes the next revision, because the revoked right keeps its number and
 * `UQ_entitlement_number` holds it.
 */
describe('deriveEntitlementNumber', () => {
	const ORDER = '0a1b2c3d-1111-2222-3333-444455556666';
	const LINE = '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff';
	const SUBSCRIPTION = 'abcdef01-2345-6789-abcd-ef0123456789';

	it('numbers an order line grant from the order, the line and the kind', () => {
		expect(deriveEntitlementNumber({ orderId: ORDER, orderLineId: LINE, kind: EntitlementKind.LICENCE })).toBe(
			'E-0A1B2C3D-9F8E7D6C-L'
		);
	});

	it('numbers a subscription grant from the subscription and the kind', () => {
		expect(deriveEntitlementNumber({ subscriptionId: SUBSCRIPTION, kind: EntitlementKind.LICENCE })).toBe(
			'E-SUB-ABCDEF01-L'
		);
	});

	it('defaults the kind to a licence', () => {
		expect(deriveEntitlementNumber({ orderId: ORDER, orderLineId: LINE })).toBe('E-0A1B2C3D-9F8E7D6C-L');
	});

	it('prefers the order line over the subscription when both are named', () => {
		expect(
			deriveEntitlementNumber({
				orderId: ORDER,
				orderLineId: LINE,
				subscriptionId: SUBSCRIPTION,
				kind: EntitlementKind.LICENCE
			})
		).toBe('E-0A1B2C3D-9F8E7D6C-L');
	});

	it('derives nothing for a right that came from no purchase, or from a line without its order', () => {
		expect(deriveEntitlementNumber({ kind: EntitlementKind.LICENCE })).toBeUndefined();
		expect(deriveEntitlementNumber({ orderLineId: LINE, kind: EntitlementKind.LICENCE })).toBeUndefined();
		expect(deriveEntitlementNumber({ orderLineId: LINE, kind: EntitlementKind.LICENCE }, 3)).toBeUndefined();
	});

	it('keeps revision 0 as the number it always was, and suffixes every later revision', () => {
		const input = { orderId: ORDER, orderLineId: LINE, kind: EntitlementKind.LICENCE };

		expect(deriveEntitlementNumber(input, 0)).toBe('E-0A1B2C3D-9F8E7D6C-L');
		expect(deriveEntitlementNumber(input, 1)).toBe('E-0A1B2C3D-9F8E7D6C-L-2');
		expect(deriveEntitlementNumber(input, 2)).toBe('E-0A1B2C3D-9F8E7D6C-L-3');
		expect(deriveEntitlementNumber({ subscriptionId: SUBSCRIPTION }, 1)).toBe('E-SUB-ABCDEF01-L-2');
	});

	it('stays inside the 32-character number column at the last revision it tries', () => {
		const longest = deriveEntitlementNumber(
			{ orderId: ORDER, orderLineId: LINE, kind: EntitlementKind.LICENCE },
			DERIVED_ENTITLEMENT_NUMBER_ATTEMPTS - 1
		);

		expect(longest).toBe('E-0A1B2C3D-9F8E7D6C-L-10');
		expect(String(longest).length).toBeLessThanOrEqual(32);
	});
});
