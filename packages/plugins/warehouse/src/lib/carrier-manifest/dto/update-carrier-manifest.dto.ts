import { PartialType } from '@nestjs/mapped-types';
import { CarrierManifestDTO } from './carrier-manifest.dto';

/**
 * An update to a draft manifest.
 *
 * Membership is read-only at every status: while a draft resolves it from the shipments, and once it
 * is closed it is frozen. Only the window, the day and the note may still be corrected.
 */
export class UpdateCarrierManifestDTO extends PartialType(CarrierManifestDTO) {}
