import { PartialType } from '@nestjs/mapped-types';
import { WarehouseBinDTO } from './warehouse-bin.dto';

/**
 * An update to a bin.
 *
 * A bin that holds a stated amount of stock is blocked rather than removed, and its code is immutable
 * once a pick list has printed it — so the fields a caller may change are the ones a re-labelling of
 * the shelf does not invalidate.
 */
export class UpdateWarehouseBinDTO extends PartialType(WarehouseBinDTO) {}
