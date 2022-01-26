import { IOrganizationProject, ITaskUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmptyObject, IsObject } from "class-validator";
import { TaskDTO } from "./task.dto";

export class UpdateTaskDTO extends TaskDTO implements ITaskUpdateInput {

    @ApiProperty({ type : () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly project?: IOrganizationProject;
    
}