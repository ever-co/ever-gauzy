import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNotEmptyObject, IsObject, ValidateNested } from "class-validator";
import { IEmployee, IEmployeeCreateInput, IOrganization } from "@gauzy/contracts";
import { EmploymentDTO } from "./employment.dto";
import { UserInputDTO } from "./user-input-dto";

export class EmployeeInputDTO extends EmploymentDTO implements IEmployeeCreateInput {

    @ApiProperty({ type: () => UserInputDTO, required : true })
    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => UserInputDTO)
    readonly user: UserInputDTO;

    @IsNotEmpty()
    readonly password: string;

    readonly members?: IEmployee[];
    readonly organizationId?: string;
    originalUrl?: string;

    @IsObject()
    @IsNotEmptyObject()
    readonly organization?: IOrganization;
}