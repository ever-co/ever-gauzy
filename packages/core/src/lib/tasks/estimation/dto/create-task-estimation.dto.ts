import { ITaskEstimation } from '@gauzy/contracts';
import { TaskEstimationDTO } from './task-estimation.dto';

export class CreateTaskEstimationDTO
	extends TaskEstimationDTO
	implements ITaskEstimation {}
