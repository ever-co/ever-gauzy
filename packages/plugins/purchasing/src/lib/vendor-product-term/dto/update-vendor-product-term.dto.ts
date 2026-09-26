import { PartialType } from '@nestjs/mapped-types';
import { VendorProductTermDTO } from './vendor-product-term.dto';

/**
 * An update to a vendor term.
 *
 * Everything is optional, and the service refuses an amendment that would leave two live terms of one
 * supplier, variant and currency claiming the same quantity band: a term is a standing agreement and
 * a change to it is precisely where an overlap is introduced.
 */
export class UpdateVendorProductTermDTO extends PartialType(VendorProductTermDTO) {}
