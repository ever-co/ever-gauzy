import { IGithubAppInstallInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export class GithubAppInstallDTO extends TenantOrganizationBaseDTO implements IGithubAppInstallInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly installation_id: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly setup_action: string;
}
