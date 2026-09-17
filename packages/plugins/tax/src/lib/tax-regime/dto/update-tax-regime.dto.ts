import { PartialType } from '@nestjs/mapped-types';
import { TaxRegimeDTO } from './tax-regime.dto';

/**
 * Update tax regime request DTO validation.
 *
 * Every member is optional: a regime is amended by sending the members that change. A regime is never
 * hard-deleted once a document was taxed under it — the row is retired — because the regime a document was
 * taxed under is part of its tax evidence.
 */
export class UpdateTaxRegimeDTO extends PartialType(TaxRegimeDTO) {}
