import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ExchangeRateDTO } from './exchange-rate.dto';

/**
 * Update exchange rate request validation.
 *
 * The currency pair and the instant the rate became valid are the row's business key, so they are
 * omitted: correcting a rate that was entered wrongly for a moment is a delete and a re-create,
 * which is also what keeps the "greatest `validFrom` wins" lookup unambiguous. `rate`, `validUntil`
 * and `isManual` are editable, because re-quoting a rate and closing its window are the two things
 * that actually happen to one.
 */
export class UpdateExchangeRateDTO extends PartialType(
	OmitType(ExchangeRateDTO, ['fromCurrency', 'toCurrency', 'validFrom'] as const)
) {}
