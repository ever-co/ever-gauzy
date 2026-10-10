import { PartialType } from '@nestjs/mapped-types';
import { CreateGiftCardTransactionDTO } from './create-gift-card-transaction.dto';

/**
 * Update GiftCardTransaction request: every field of the create shape, all of them optional.
 */
export class UpdateGiftCardTransactionDTO extends PartialType(CreateGiftCardTransactionDTO) {}
