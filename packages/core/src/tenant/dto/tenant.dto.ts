import { IOrganization, ITenant } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class TenantDTO implements ITenant {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly name?: string;

    @ApiPropertyOptional({ type: () => Array })
    @IsOptional()
    @IsArray()
    organizations?: IOrganization[];

}