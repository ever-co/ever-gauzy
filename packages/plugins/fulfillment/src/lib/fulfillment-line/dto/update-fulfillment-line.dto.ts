import { PartialType } from '@nestjs/mapped-types';
import { FulfillmentLineDTO } from './fulfillment-line.dto';

/** Update request validation. */
export class UpdateFulfillmentLineDTO extends PartialType(FulfillmentLineDTO) {}