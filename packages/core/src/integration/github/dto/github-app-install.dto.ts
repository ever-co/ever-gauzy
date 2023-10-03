import { IGithubAppInstallInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export enum GithubSetupActionEnum {
    INSTALL = 'install',
    UPDATE = 'update'
}

export class GithubOAuthDTO extends TenantOrganizationBaseDTO implements IGithubAppInstallInput {
    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly code: string;
}

export class GithubAppInstallDTO extends GithubOAuthDTO implements IGithubAppInstallInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly installation_id: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsEnum(GithubSetupActionEnum)
    readonly setup_action: GithubSetupActionEnum;
}
