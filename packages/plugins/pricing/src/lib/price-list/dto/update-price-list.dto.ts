import { PartialType } from '@nestjs/mapped-types';
import { PriceListDTO } from './price-list.dto';

/**
 * Update price list request validation.
 *
 * Every authorable field may change, including `code`: a code is a stable address for integrations,
 * not a primary key, and renaming one is a deliberate operator action rather than something the
 * API should refuse.
 */
export class UpdatePriceListDTO extends PartialType(PriceListDTO) {}
