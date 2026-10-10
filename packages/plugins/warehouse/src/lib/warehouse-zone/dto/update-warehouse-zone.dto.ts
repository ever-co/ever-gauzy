import { PartialType } from '@nestjs/mapped-types';
import { WarehouseZoneDTO } from './warehouse-zone.dto';

/**
 * An update to a zone.
 *
 * Everything is optional, and the service refuses the updates that would invalidate a printed
 * document: the location cannot move, a zone that holds bins is blocked rather than emptied, and the
 * temperature window is re-checked whole rather than field by field.
 */
export class UpdateWarehouseZoneDTO extends PartialType(WarehouseZoneDTO) {}
