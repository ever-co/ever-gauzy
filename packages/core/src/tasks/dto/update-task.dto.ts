import { ITaskUpdateInput } from "@gauzy/contracts";
import { TaskDTO } from "./task.dto";

export class UpdateTaskDTO extends TaskDTO implements ITaskUpdateInput { }