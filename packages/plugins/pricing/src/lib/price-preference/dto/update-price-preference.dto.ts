import { OmitType, PartialType } from '@nestjs/mapped-types';
import { PricePreferenceDTO } from './price-preference.dto';

/**
 * Update price preference request validation.
 *
 * `attribute` and `value` are immutable together: they *are* the row's identity, and changing them
 * would move the answer to a different scope while leaving the old scope unanswered. A preference
 * for another scope is a new preference.
 */
export class UpdatePricePreferenceDTO extends PartialType(
	OmitType(PricePreferenceDTO, ['attribute', 'value'] as const)
) {}
