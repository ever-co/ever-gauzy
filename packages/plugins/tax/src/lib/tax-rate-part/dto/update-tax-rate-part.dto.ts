import { PartialType } from '@nestjs/mapped-types';
import { TaxRatePartDTO } from './tax-rate-part.dto';

/**
 * A single part of a rate, addressed by its own id.
 *
 * The route exists so an operator can correct one element without restating the list; the list endpoint
 * is what writes a breakdown, because the shares of the parts have to add up and one element cannot be
 * judged on its own.
 */
export class UpdateTaxRatePartDTO extends PartialType(TaxRatePartDTO) {}
