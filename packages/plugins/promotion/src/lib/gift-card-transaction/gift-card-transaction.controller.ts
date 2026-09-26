import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { GiftCardTransaction } from './gift-card-transaction.entity';
import { GiftCardTransactionService } from './gift-card-transaction.service';
import { CreateGiftCardTransactionDTO, UpdateGiftCardTransactionDTO } from './dto';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The gift-card-transaction resource: the movements of every card.
 *
 * The ledger is append-only and is the authority on what a card is worth: the balance column on the
 * card is a materialised cache of these rows, rebuilt from them, so the domain appends a movement
 * rather than rewording one — a correction is another movement carrying its reason, not an edit of
 * the movement it corrects. Each movement records the amount, the balance it left behind and what
 * caused it — an issue, a redemption against an order, value returned on a refund, a manual
 * correction with its reason, or a balance forfeited at expiry.
 *
 * This controller adds no rule of its own beyond that: it exists so that a card's history can be read
 * and reconciled against the card's balance, and every row in it was written by one of the gift-card
 * operations through the service. The two write routes below are declared rather than inherited
 * because a body is validated from the type the handler names, and the base class names the entity's
 * shape as a generic — a parameter the validation pipe cannot name a class for is not validated at
 * all, so an inherited route accepts any body and writes it. They are the repair surface a
 * reconciliation uses, and they carry the edit grant rather than the read one, because a row written
 * here changes what the card is worth.
 */
@ApiTags('GiftCardTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
@Controller('/gift-card-transactions')
export class GiftCardTransactionController extends CrudController<GiftCardTransaction> {
	constructor(private readonly giftCardTransactionService: GiftCardTransactionService) {
		super(giftCardTransactionService);
	}

	/**
	 * Appends one movement to a card's ledger, recording the balance it left behind.
	 *
	 * @param entity The movement to append.
	 * @returns The stored movement.
	 */
	@ApiOperation({ summary: 'Append a gift card transaction' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Transaction appended' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid transaction input' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateGiftCardTransactionDTO): Promise<GiftCardTransaction> {
		return this.giftCardTransactionService.create(entity as never);
	}

	/**
	 * Corrects a movement in a card's ledger.
	 *
	 * @param id The movement to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a gift card transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Transaction updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Transaction not found' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateGiftCardTransactionDTO) {
		return this.giftCardTransactionService.update(id, entity as never);
	}

	/**
	 * Deletes a movement from a card's ledger.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the destructive grant the route needs, `GIFT_CARDS_EDIT`: the row belongs
	 * to one card, and that card's own delete route carries the plugin's edit grant.
	 *
	 * @param id The movement to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a gift card transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Transaction deleted' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a movement from a card's ledger.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the same destructive grant the delete above states, `GIFT_CARDS_EDIT`,
	 * because removing a movement changes what the card is worth.
	 *
	 * @param id The movement to soft delete.
	 * @returns The soft-deleted movement.
	 */
	@ApiOperation({ summary: 'Soft delete a gift card transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Transaction soft deleted' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted movement of a card's ledger.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the same destructive grant the delete above states, `GIFT_CARDS_EDIT`,
	 * because a restored movement is counted in the card's balance again.
	 *
	 * @param id The movement to restore.
	 * @returns The restored movement.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted gift card transaction' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Transaction restored' })
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
