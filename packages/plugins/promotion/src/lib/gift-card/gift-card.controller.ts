import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { GiftCard } from './gift-card.entity';
import { GiftCardService } from './gift-card.service';
import { CreateGiftCardDTO, UpdateGiftCardDTO } from './dto';
import { GiftCardStatus, IGiftCard } from '../promotion.types';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The gift-card resource: a stored-value instrument and the four movements it accepts.
 *
 * A card is a liability, which is why issuing it is a permission of its own rather than one more
 * thing an editor may do. Spending it, returning value to it, correcting it and withdrawing it are
 * four different facts and each has its own route, because they are recorded differently in the
 * card's ledger: a redemption is negative, a refund gives value back, an adjustment is a manual
 * correction in either direction that has to carry its reason, and a cancellation keeps the ledger
 * while taking the card out of circulation.
 *
 * `balance` is the one route that takes a code rather than an identifier. It exists for the caller
 * who holds a card and not its id — a customer, or an agent on the phone — and it is answered from
 * the ledger, so the figure it reports is the one the card would actually spend. The optional `pin`
 * is the second factor a card may carry; it is compared where it is stored, never read back here.
 */
@ApiTags('GiftCard')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
@Controller('/gift-cards')
export class GiftCardController extends CrudController<GiftCard> {
	constructor(private readonly giftCardService: GiftCardService) {
		super(giftCardService);
	}

	/**
	 * Issues a card.
	 *
	 * The face value is credited as the card's first ledger row, so a balance always has a
	 * provenance. Issuing is granted separately from editing, because every card issued is money the
	 * business owes.
	 *
	 * @param entity The card to issue.
	 * @returns The issued card.
	 */
	@ApiOperation({ summary: 'Issue a gift card' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Gift card issued' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The face value is not positive' })
	@Permissions(PromotionPermission.GIFT_CARDS_ISSUE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateGiftCardDTO): Promise<IGiftCard> {
		return this.giftCardService.issue(entity as never);
	}

	/**
	 * Reads the balance of a card from its code, for a caller who holds the card and not its id.
	 *
	 * @param query The code presented, and the pin when the card carries one.
	 * @returns The balance, the currency and the status of the card.
	 */
	@ApiOperation({ summary: 'Read a gift card balance by code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Balance retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No card carries that code' })
	@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
	@Get('balance')
	async balance(
		@Query() query: { code: string; pin?: string }
	): Promise<{ balance: string; currency: string; status: GiftCardStatus }> {
		return this.giftCardService.balanceByCode(query?.code, query?.pin);
	}

	/**
	 * Changes a card's expiry, holder or metadata. The balance is not editable here: it is what the
	 * ledger says it is, and the adjustment route is the way to correct it.
	 *
	 * @param id The card to change.
	 * @param entity The fields to change.
	 * @returns The stored card.
	 */
	@ApiOperation({ summary: 'Update a gift card' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gift card updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Gift card not found' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateGiftCardDTO): Promise<IGiftCard> {
		await this.giftCardService.update(id, entity as never);

		return this.giftCardService.findCardOrFail(id);
	}

	/**
	 * Deletes a card. The card's ledger is kept, so a deleted card can still be explained.
	 *
	 * @param id The card to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a gift card' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Gift card deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Gift card not found' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return this.giftCardService.delete(id);
	}

	/**
	 * Spends part of a card's balance against an order.
	 *
	 * The amount applied is the smallest of what was asked for, the balance the ledger holds, and what
	 * the order still owes — a card never overpays an order and never spends more than it carries.
	 *
	 * @param id The card to spend.
	 * @param body The amount requested and the order it is spent against.
	 * @returns The card after the redemption and the amount actually applied.
	 */
	@ApiOperation({ summary: 'Redeem a gift card against an order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gift card redeemed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The card is not redeemable' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Post(':id/redeem')
	@HttpCode(HttpStatus.OK)
	async redeem(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { amount: string; orderId?: ID; orderCurrency?: string; outstanding?: string }
	): Promise<{ card: IGiftCard; applied: string }> {
		return this.giftCardService.redeem(id, body?.amount, body);
	}

	/**
	 * Returns value to a card, on a refund that was paid back onto it.
	 *
	 * @param id The card to credit.
	 * @param body The amount to return and the order it came from.
	 * @returns The card after the refund and the amount actually returned.
	 */
	@ApiOperation({ summary: 'Refund value back onto a gift card' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gift card refunded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The refund is not applicable' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Post(':id/refund')
	@HttpCode(HttpStatus.OK)
	async refund(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { amount: string; orderId?: ID; note?: string }
	): Promise<{ card: IGiftCard; applied: string }> {
		return this.giftCardService.refund(id, body?.amount, body);
	}

	/**
	 * Corrects a card's balance by hand, in either direction.
	 *
	 * The note is required by the service: an adjustment without a reason is indistinguishable from a
	 * defect, and the ledger row it writes is the only place the correction will ever be explained.
	 *
	 * @param id The card to correct.
	 * @param body The signed amount and the reason for it.
	 * @returns The card after the correction and the amount actually applied.
	 */
	@ApiOperation({ summary: 'Adjust a gift card balance' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gift card adjusted' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The adjustment carries no reason' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Post(':id/adjust')
	@HttpCode(HttpStatus.OK)
	async adjust(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { amount: string; note: string }
	): Promise<{ card: IGiftCard; applied: string }> {
		return this.giftCardService.adjust(id, body?.amount, body?.note);
	}

	/**
	 * Withdraws a card from circulation.
	 *
	 * The card is canceled rather than deleted, and its ledger is left intact: the money that was
	 * spent with it, and the balance that was forfeited, are facts the books have to keep.
	 *
	 * @param id The card to cancel.
	 * @param body The reason the card is being withdrawn.
	 * @returns The canceled card.
	 */
	@ApiOperation({ summary: 'Cancel a gift card' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gift card canceled' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Gift card not found' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	async cancel(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { reason?: string }
	): Promise<IGiftCard> {
		return this.giftCardService.cancel(id, body?.reason);
	}
}
