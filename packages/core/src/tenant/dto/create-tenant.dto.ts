import { ITenantCreateInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { TenantDTO } from "./tenant.dto";

export class CreateTenantDTO extends TenantDTO implements ITenantCreateInput {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isImporting: boolean;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly sourceId: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly userSourceId: string;
}