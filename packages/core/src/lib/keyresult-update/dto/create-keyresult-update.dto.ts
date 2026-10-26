import { IKeyResultUpdate } from '@gauzy/contracts';
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { KeyresultUpdateDTO } from './keyresult-update.dto';

/**
 * Files a progress update (`POST /key-result-updates`).
 *
 * `progress` may be omitted: filing an update applies it, and the service computes the progress from the
 * reported value and the key result (`KeyResultUpdateService.fileProgressUpdate`), ignoring a stated one. A
 * stated value is still checked to be a number. Editing a filed update (`UpdateKeyresultUpdateDTO`) keeps it
 * required.
 */
export class CreateKeyresultUpdateDTO
	extends IntersectionType(
		OmitType(KeyresultUpdateDTO, ['progress'] as const),
		PartialType(PickType(KeyresultUpdateDTO, ['progress'] as const))
	)
	implements Omit<IKeyResultUpdate, 'progress'> {}
