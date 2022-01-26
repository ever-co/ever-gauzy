import { IOrganizationProject, ITaskCreateInput} from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmptyObject, IsObject } from "class-validator";
import { TaskDTO } from "./task.dto";

export class CreateTaskDTO extends TaskDTO implements ITaskCreateInput {
    
    @ApiProperty({ type : () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly project?: IOrganizationProject;
    
}