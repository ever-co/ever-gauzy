import { ForceDeleteBaseDTO } from '../../core/dto';
import { ApiCallLog } from '../api-call-log.entity';

/**
 * Data Transfer Object (DTO) for deleting an API call log with the `forceDelete` flag.
 * This DTO extends the `ForceDeleteBaseDTO` to include the `forceDelete` flag.
 */
export class DeleteApiCallLogDTO extends ForceDeleteBaseDTO<ApiCallLog> {}
