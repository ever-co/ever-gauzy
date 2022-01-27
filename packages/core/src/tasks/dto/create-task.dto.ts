import { IOrganization, ITaskCreateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TaskDTO } from "./task.dto";

export class CreateTaskDTO extends TaskDTO 
    implements ITaskCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly organizationId: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly organization: IOrganization;
}