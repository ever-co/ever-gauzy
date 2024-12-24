import { TaskEstimationCreateHandler } from './task-estimation-create.handler';
import { TaskEstimationUpdateHandler } from './task-estimation-update.handler';
import { TaskEstimationDeleteHandler } from './task-estimation-delete.handler';
import { TaskEstimationCalculateHandler } from './task-estimation-calculate.handler';

export const CommandHandlers = [
	TaskEstimationCreateHandler,
	TaskEstimationUpdateHandler,
	TaskEstimationDeleteHandler,
	TaskEstimationCalculateHandler,
];
