import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerTransactionDTO } from './seller-transaction.dto';

/**
 * Update request validation.
 *
 * The only fields the API may move on an existing ledger row are its status and its hold reason: the amounts are append only, and a correction is a reversal row.
 */
export class UpdateSellerTransactionDTO extends PartialType(OmitType(SellerTransactionDTO, ['sellerId', 'orderId', 'orderLineId', 'kind', 'currency'] as const)) {}