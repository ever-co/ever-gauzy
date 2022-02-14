import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export class KeyresultUpdateDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly keyResultId?: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly owner: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly progress: number;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly update: number;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly status: string;

}