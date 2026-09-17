import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerSettlementDTO } from './seller-settlement.dto';

/**
 * Update request validation.
 *
 * The provider, the seller and the currency of a settlement never change; its status and its reconciliation do, and a closed settlement accepts neither.
 */
export class UpdateSellerSettlementDTO extends PartialType(OmitType(SellerSettlementDTO, ['sellerId', 'providerKey', 'currency', 'payoutId'] as const)) {}