import { IDeleteScreenshot } from '@gauzy/contracts';
import { ForceDeleteBaseDTO } from '../../../core/dto';
import { Screenshot } from '../screenshot.entity';

/**
 * Data Transfer Object (DTO) for deleting screenshots with the `forceDelete` flag.
 * This DTO extends the `ForceDeleteBaseDTO` to include the `forceDelete` flag.
 */
export class DeleteScreenshotDTO extends ForceDeleteBaseDTO<Screenshot> implements IDeleteScreenshot {}
