import { UseGuards } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { IGoodsReceipt, IGoodsReceiptLine } from '../../purchasing.types';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { GoodsReceipt } from '../../goods-receipt/goods-receipt.entity';
import { GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';

/**
 * The goods-receipt line's own field.
 *
 * A receipt line is written with its receipt, so it is normally read through it. This resolver exists
 * for the one case where it is not: a caller that reached a line by order line, and needs the delivery
 * it belongs to in order to know when and where it arrived.
 *
 * **Authorisation is the controller's.** A line with no root field is still served through the one
 * GraphQL endpoint, so the class carries the guard chain, the platform's feature gate and the read
 * permission the goods-receipt-line controller class carries — `GOODS_RECEIPTS_VIEW`, which is the
 * permission that controller's own list route states, and the permission the receipt these fields are
 * selected through is read under. The platform gate is `FEATURE_GRAPHQL`, imported from the catalogue
 * rather than restated: a literal that drifted would name a code no catalogue row carries, which the
 * guard resolves as disabled and which would refuse this field for every caller with nothing red
 * anywhere.
 */
@Resolver('GoodsReceiptLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
export class GoodsReceiptLineResolver {
	constructor(private readonly goodsReceiptService: GoodsReceiptService) {}

	/**
	 * Resolves the receipt a line belongs to.
	 *
	 * @param line The line being read.
	 * @returns The receipt, or null when it cannot be read.
	 */
	@ResolveField('receipt')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async receipt(@Parent() line: IGoodsReceiptLine): Promise<GoodsReceipt | null> {
		const attached = (line as { receipt?: IGoodsReceipt }).receipt;

		if (attached?.id) {
			return attached as GoodsReceipt;
		}

		if (!line.receiptId) {
			return null;
		}

		try {
			return await this.goodsReceiptService.findOneDetailed(line.receiptId);
		} catch (error) {
			return null;
		}
	}
}
