import { IEmployee } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";
import { Employee } from "./../../core/entities/internal";

export class EmployeeFeatureDTO {

    @ApiProperty({ type: () => Employee, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly employee: IEmployee;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly employeeId: string;
}