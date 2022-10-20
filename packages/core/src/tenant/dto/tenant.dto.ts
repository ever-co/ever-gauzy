import { ITenant } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class TenantDTO implements ITenant {

    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly logo: string;
}