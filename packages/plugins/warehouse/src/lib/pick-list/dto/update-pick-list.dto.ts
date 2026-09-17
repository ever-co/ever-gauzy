import { PartialType } from '@nestjs/mapped-types';
import { PickListDTO } from './pick-list.dto';

/**
 * An update to a pick list.
 *
 * Only the fields a dispatcher may still change are meaningful: the assignee, the priority and the
 * picker-facing note. The route and the bin order are frozen from the moment a picker owns the list,
 * so a line can only be corrected through the outcome routes that record what happened.
 */
export class UpdatePickListDTO extends PartialType(PickListDTO) {}
