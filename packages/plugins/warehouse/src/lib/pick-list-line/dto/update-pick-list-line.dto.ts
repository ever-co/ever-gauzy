import { PartialType } from '@nestjs/mapped-types';
import { PickListLineDTO } from './pick-list-line.dto';

/**
 * An update to a pick line.
 *
 * An outcome is never written through this shape: picking, substituting, skipping and closing short
 * each have their own route, because each of them has a stock consequence and a state the line may
 * only be in when it is attempted.
 */
export class UpdatePickListLineDTO extends PartialType(PickListLineDTO) {}
