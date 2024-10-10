import { IDeleteScreenshot } from '@gauzy/contracts';
import { ForceDeleteDTO } from '../../../time-tracking/dto/force-delete.dto';
import { Screenshot } from '../screenshot.entity';

/**
 * Data Transfer Object for deleting screenshots.
 *
 * This DTO is used to define the structure of the data required for deleting
 * screenshots. It extends the `DeleteQueryDTO`, which includes tenant and
 * organization context. The DTO also extends `ForceDeleteDTO` to include an optional
 * `forceDelete` flag to determine whether a hard or soft delete should be performed.
 */
export class DeleteScreenshotDTO extends ForceDeleteDTO<Screenshot> implements IDeleteScreenshot {}
