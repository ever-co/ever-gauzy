import { PartialType } from '@nestjs/mapped-types';
import { TaxRateDTO } from './tax-rate.dto';

/**
 * Update tax rate request DTO validation.
 *
 * Every member is optional, including the zone: a rate is corrected in place rather than superseded,
 * because the amounts already charged are snapshotted on the tax line and are not rewritten by an edit
 * of the rate they came from.
 */
export class UpdateTaxRateDTO extends PartialType(TaxRateDTO) {}
