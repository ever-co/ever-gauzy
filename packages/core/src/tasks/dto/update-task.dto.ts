import { ITaskUpdateInput } from '@gauzy/contracts';
import { CreateTaskDTO } from './create-task.dto';

/**
 * Update task validation request DTO
 */
export class UpdateTaskDTO extends CreateTaskDTO implements ITaskUpdateInput {}
