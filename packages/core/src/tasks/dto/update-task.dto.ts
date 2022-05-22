import { ITaskUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { TaskDTO } from "./task.dto";

export class UpdateTaskDTO extends IntersectionType(
    TaskDTO,
    RelationalTagDTO,
) implements ITaskUpdateInput {}