import { PartialType } from '@nestjs/mapped-types';
import { CommerceCartLineDTO } from './commerce-cart-line.dto';

/** Change line request validation. */
export class UpdateCommerceCartLineDTO extends PartialType(CommerceCartLineDTO) {}
