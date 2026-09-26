import { PartialType } from '@nestjs/mapped-types';
import { CommerceCartDTO } from './commerce-cart.dto';

/** Update cart request validation. Every field is optional; the version guard is the header's job. */
export class UpdateCommerceCartDTO extends PartialType(CommerceCartDTO) {}
