import { PartialType } from '@nestjs/mapped-types';
import { CommerceCheckoutSessionDTO } from './commerce-checkout-session.dto';

/** Change a checkout session request validation. */
export class UpdateCommerceCheckoutSessionDTO extends PartialType(CommerceCheckoutSessionDTO) {}
