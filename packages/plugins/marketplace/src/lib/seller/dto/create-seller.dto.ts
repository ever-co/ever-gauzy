import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerDTO } from './seller.dto';

/**
 * Create-seller request validation.
 *
 * `contactId`, `code` and `name` are the required fields: a seller without a party cannot be
 * verified, contracted with or taxed, and a seller without a code cannot be referred to.
 */
export class CreateSellerDTO extends IntersectionType(
	PickType(SellerDTO, ['contactId', 'code', 'name'] as const),
	SellerDTO
) {}
