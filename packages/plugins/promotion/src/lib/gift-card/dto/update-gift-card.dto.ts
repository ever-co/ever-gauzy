import { PartialType } from '@nestjs/mapped-types';
import { CreateGiftCardDTO } from './create-gift-card.dto';

/**
 * Update GiftCard request: every field of the create shape, all of them optional.
 */
export class UpdateGiftCardDTO extends PartialType(CreateGiftCardDTO) {}
