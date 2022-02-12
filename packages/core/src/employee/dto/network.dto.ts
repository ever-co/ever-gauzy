import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsOptional, IsUrl } from "class-validator";

export class SocialNetworksDTO {
    
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "LinkedIn must be an URL address"
    })
    readonly linkedInUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Facebook must be an URL address"
    })
    readonly facebookUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Instagram must be an URL address"
    })
    readonly instagramUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Twitter must be an URL address"
    })
    readonly twitterUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Github must be an URL address"
    })
    readonly githubUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Gitlab must be an URL address"
    })
    readonly gitlabUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Upwork must be an URL address"
    })
    readonly upworkUrl?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
    @IsUrl({}, {
        message: "Stackoverflow must be an URL address"
    })
    readonly stackoverflowUrl?: string;
}