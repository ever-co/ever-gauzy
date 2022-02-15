import { IEmployee, IOrganizationTeam } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export abstract class GoalDTO {

    @ApiProperty({ type : () => String, readOnly : true })
    @IsNotEmpty()
    @IsString()
    readonly name : string;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly description : string;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly deadline: string;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly level: string;

    @ApiProperty({ type : () => Number, readOnly : true })
    @IsOptional()
    @IsNumber()
    readonly progress: number;

    @ApiProperty({ type : () => Object, readOnly : true })
    @IsOptional()
    @IsObject()
    readonly ownerTeam: IOrganizationTeam;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly ownerTeamId: string;

    @ApiProperty({ type : () => Object, readOnly : true })
    @IsOptional()
    @IsObject()    
    readonly ownerEmployee: IEmployee;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly ownerEmployeeId: string;

    @ApiProperty({ type : () => Object, readOnly : true })
    @IsOptional()
    @IsObject()   
    readonly lead: IEmployee;

    @ApiProperty({ type : () => String, readOnly : true })
    @IsOptional()
    @IsString()
    readonly leadId: string;
}