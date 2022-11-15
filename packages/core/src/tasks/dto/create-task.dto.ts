import { ITaskCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/swagger";
import { RelationalTagDTO } from "./../../tags/dto";
import { TaskDTO } from "./task.dto";

export class CreateTaskDTO extends IntersectionType(
    TaskDTO,
    RelationalTagDTO,
) implements ITaskCreateInput {}