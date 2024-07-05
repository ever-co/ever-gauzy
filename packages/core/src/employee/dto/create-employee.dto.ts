import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsObject, IsString, ValidateIf, ValidateNested } from "class-validator";
import { IntersectionType } from "@nestjs/mapped-types";
import { IEmployee, IEmployeeCreateInput, IUser } from "@gauzy/contracts";
import { EmploymentDTO } from "./employment.dto";
import { UserInputDTO } from "./user-input-dto";
import { RelationalTagDTO } from "./../../tags/dto";

/**
 * Employee Create DTO
 *
 */
export class CreateEmployeeDTO extends IntersectionType(
    EmploymentDTO,
    RelationalTagDTO
) implements IEmployeeCreateInput {
    /**
     * Create user to the employee
     */
    @ApiPropertyOptional({ type: () => UserInputDTO })
    @ValidateIf((it) => !it.userId)
    @IsObject()
    @ValidateNested()
    @Type(() => UserInputDTO)
    readonly user: UserInputDTO;

    /**
     * Sync user to the employee
     */
    @ApiPropertyOptional({ type: () => String })
    @ValidateIf((it) => !it.user)
    @IsNotEmpty()
    @IsString()
    readonly userId: IUser['id'];

    @ApiProperty({ type: () => String, required: true })
    @ValidateIf((it) => !it.userId)
    @IsNotEmpty()
    readonly password: string;

    readonly members?: IEmployee[];
    public originalUrl?: string;
}
