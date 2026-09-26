import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerDTO } from './seller.dto';

/**
 * Update-seller request validation.
 *
 * The party binding and the code are immutable: a seller belongs to one organization and one contact
 * forever, and its code is the stable key a ledger row and a statement are read by. Everything a
 * seller may legitimately change about itself — its profile, its commission defaults, its payout
 * terms and its tax identifiers — is updatable here.
 */
export class UpdateSellerDTO extends PartialType(OmitType(SellerDTO, ['contactId', 'code'] as const)) {}
