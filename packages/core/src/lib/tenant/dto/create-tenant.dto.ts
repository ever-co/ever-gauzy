import { ITenantCreateInput } from "@gauzy/contracts";
import { ApiHideProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { TenantDTO } from "./tenant.dto";

export class CreateTenantDTO extends TenantDTO implements ITenantCreateInput {

    @ApiHideProperty()
    @IsOptional()
    @IsBoolean()
    readonly isImporting: boolean;

    @ApiHideProperty()
    @IsOptional()
    readonly sourceId: string;

    @ApiHideProperty()
    @IsOptional()
    readonly userSourceId: string;
}