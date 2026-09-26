import { PartialType } from '@nestjs/mapped-types';
import { PickWaveDTO } from './pick-wave.dto';

/**
 * An update to a wave that has not been released.
 *
 * Once a wave is on the floor its contents are frozen: a shipment added after release would have no
 * pinned bin, and a shipment removed after a line was picked would leave work recorded against
 * nothing.
 */
export class UpdatePickWaveDTO extends PartialType(PickWaveDTO) {}
