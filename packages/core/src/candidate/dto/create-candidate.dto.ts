import { ICandidateCreateInput, ICandidateDocument } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, MinLength, ValidateNested } from "class-validator";
import { EmploymentDTO, UserInputDTO } from "employee/dto";

export class CreateCandidateDTO extends EmploymentDTO implements ICandidateCreateInput {

    @ApiProperty({ type: () => UserInputDTO, required : true })
    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => UserInputDTO)
    readonly user: UserInputDTO;

    @ApiProperty({ type: () => String, required : true })
    @IsNotEmpty({ message: "Password should not be empty" })
    @MinLength(4, {
        message: 'Password should be at least 4 characters long.'
    })
    readonly password: string;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly documents: ICandidateDocument[];

}