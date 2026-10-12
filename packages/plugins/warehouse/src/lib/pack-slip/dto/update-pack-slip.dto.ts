import { PartialType } from '@nestjs/mapped-types';
import { PackSlipDTO } from './pack-slip.dto';

/**
 * An update to an open pack slip.
 *
 * A `PACKED` slip is immutable: a re-pack cancels it and creates a new one, so the first packing
 * survives in the history and the label is produced against a frozen record.
 */
export class UpdatePackSlipDTO extends PartialType(PackSlipDTO) {}
