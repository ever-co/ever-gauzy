import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerTransactionDTO } from './seller-transaction.dto';

/**
 * Create request validation.
 *
 * A ledger row is written by the order split inside the order's own transaction. It is exposed as a create shape because the split service uses it, not because a caller authors one.
 */
export class CreateSellerTransactionDTO extends IntersectionType(
	SellerTransactionDTO,
	PickType(SellerTransactionDTO, ['sellerId', 'orderId'] as const)
) {}