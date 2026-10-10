import { PartialType } from '@nestjs/mapped-types';
import { FulfillmentDTO } from './fulfillment.dto';

/** Update request validation. */
export class UpdateFulfillmentDTO extends PartialType(FulfillmentDTO) {}