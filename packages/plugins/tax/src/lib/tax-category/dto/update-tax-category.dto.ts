import { PartialType } from '@nestjs/mapped-types';
import { TaxCategoryDTO } from './tax-category.dto';

/**
 * Update tax category request DTO validation.
 *
 * Every member is optional: a category is amended by sending the members that change, and the code and
 * the default flag are the two whose change the service validates against the rest of the organization.
 */
export class UpdateTaxCategoryDTO extends PartialType(TaxCategoryDTO) {}
