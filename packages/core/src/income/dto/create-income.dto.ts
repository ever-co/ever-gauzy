import { IIncomeCreateInput, ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IncomeDTO } from "./income.dto";

export class CreateIncomeDTO extends IncomeDTO implements IIncomeCreateInput {

    @ApiProperty({ type: () => String })
    @IsString()
    @IsNotEmpty()
    readonly clientId: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly employeeId: string;

    @ApiProperty({ type: () => Object, isArray : true })
    @IsOptional()
    readonly tags: ITag[];

}