import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUrl } from "class-validator";
import { TenantOrganizationBaseDTO } from "../../core/dto";
import { Trimmed } from "../../shared/decorators/trim.decorator";

export class SocialNetworksDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "LinkedIn must be an URL address"
    })
    readonly linkedInUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Facebook must be an URL address"
    })
    readonly facebookUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Instagram must be an URL address"
    })
    readonly instagramUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Twitter must be an URL address"
    })
    readonly twitterUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Github must be an URL address"
    })
    readonly githubUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Gitlab must be an URL address"
    })
    readonly gitlabUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Upwork must be an URL address"
    })
    readonly upworkUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
    @IsUrl({}, {
        message: "Stackoverflow must be an URL address"
    })
    readonly stackoverflowUrl?: string;
}
