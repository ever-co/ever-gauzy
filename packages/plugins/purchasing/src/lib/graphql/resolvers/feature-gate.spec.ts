/**
 * The plugin's own feature gate, on both surfaces.
 *
 * Every purchasing REST controller declares `@FeatureFlag(PurchasingFeatures.PURCHASING)`, so a tenant
 * that switched `FEATURE_PURCHASING` off is refused by `FeatureFlagGuard` on every route. The five
 * resolver classes declared only the platform's `FEATURE_GRAPHQL`, so with the capability off
 * `receivePurchaseOrder`, `approvePurchaseOrder` and every other mutation here were still served over
 * GraphQL. Each resolver now declares both codes; the kernel's decorator accumulates them and its guard
 * requires every one, which is the kernel's half and is pinned in the kernel's own specs. What is pinned
 * here is the plugin's half: the codes each class states, read off the decorator as it was applied.
 *
 * `@gauzy/common` is the real module except for the decorator, which records the code a class states and
 * otherwise does nothing: the guard that reads the metadata is not what these cases run. The controllers
 * and resolvers are the real classes over the real kernel barrel, as this package's route-parity spec
 * loads them.
 */
jest.mock('@gauzy/common', () => {
	/**
	 * Every feature code a class-level `@FeatureFlag` stated, by the class it was stated on.
	 *
	 * Exposed on the mocked module because a factory runs before this file's own declarations do.
	 */
	const declaredFeatureCodes = new Map<unknown, string[]>();

	return {
		...jest.requireActual('@gauzy/common'),
		declaredFeatureCodes,
		FeatureFlag: (code: string) => (target: unknown, key?: unknown) => {
			if (key === undefined) {
				declaredFeatureCodes.set(target, [...(declaredFeatureCodes.get(target) ?? []), code]);
			}
		}
	};
});

import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { PurchasingFeatures } from '../../purchasing.features';
import { GoodsReceiptController } from '../../goods-receipt/goods-receipt.controller';
import { GoodsReceiptLineController } from '../../goods-receipt-line/goods-receipt-line.controller';
import { PurchaseOrderController } from '../../purchase-order/purchase-order.controller';
import { PurchaseOrderLineController } from '../../purchase-order-line/purchase-order-line.controller';
import { VendorProductTermController } from '../../vendor-product-term/vendor-product-term.controller';
import { GoodsReceiptResolver } from './goods-receipt.resolver';
import { GoodsReceiptLineResolver } from './goods-receipt-line.resolver';
import { PurchaseOrderResolver } from './purchase-order.resolver';
import { PurchaseOrderLineResolver } from './purchase-order-line.resolver';
import { VendorProductTermResolver } from './vendor-product-term.resolver';

describe('the plugin feature gate — every resolver states the code its REST controller states', () => {
	const { declaredFeatureCodes } = jest.requireMock('@gauzy/common') as {
		declaredFeatureCodes: Map<unknown, string[]>;
	};

	/** Each controller and the resolver that mirrors it. */
	const MIRRORS: Array<[unknown, unknown]> = [
		[GoodsReceiptController, GoodsReceiptResolver],
		[GoodsReceiptLineController, GoodsReceiptLineResolver],
		[PurchaseOrderController, PurchaseOrderResolver],
		[PurchaseOrderLineController, PurchaseOrderLineResolver],
		[VendorProductTermController, VendorProductTermResolver]
	];

	it('declares the plugin code on every controller, as the routes are gated today', () => {
		for (const [controller] of MIRRORS) {
			expect(declaredFeatureCodes.get(controller)).toEqual([PurchasingFeatures.PURCHASING]);
		}
	});

	it('declares the platform gate and the plugin code on every resolver, and nothing else', () => {
		for (const [, resolver] of MIRRORS) {
			expect([...(declaredFeatureCodes.get(resolver) ?? [])].sort()).toEqual(
				[FEATURE_GRAPHQL, PurchasingFeatures.PURCHASING].sort()
			);
		}
	});

	it('gates each resolver on every code its controller is gated on, beyond the GraphQL endpoint itself', () => {
		for (const [controller, resolver] of MIRRORS) {
			const beyondEndpoint = (declaredFeatureCodes.get(resolver) ?? []).filter((code) => code !== FEATURE_GRAPHQL);

			expect(beyondEndpoint.sort()).toEqual([...(declaredFeatureCodes.get(controller) ?? [])].sort());
		}
	});

	it('is the code the plugin contributes to the catalogue', () => {
		expect(String(PurchasingFeatures.PURCHASING)).toBe('FEATURE_PURCHASING');
	});
});
