import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { GiftCardTransaction } from './gift-card-transaction.entity';
import { GiftCardTransactionService } from './gift-card-transaction.service';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The gift-card-transaction resource: the movements of every card.
 *
 * The ledger is append-only and is the authority on what a card is worth: the balance column on the
 * card is a materialised cache of these rows, rebuilt from them, so a row can be added and never
 * edited or removed. Each movement records the amount, the balance it left behind and what caused
 * it — an issue, a redemption against an order, value returned on a refund, a manual correction with
 * its reason, or a balance forfeited at expiry.
 *
 * This controller adds no route and no mutation of its own. It exists so that a card's history can be
 * read and reconciled against the card's balance, and every row in it was written by one of the
 * gift-card operations through the service.
 */
@ApiTags('GiftCardTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
@Controller('/gift-card-transactions')
export class GiftCardTransactionController extends CrudController<GiftCardTransaction> {
	constructor(private readonly giftCardTransactionService: GiftCardTransactionService) {
		super(giftCardTransactionService);
	}
}
