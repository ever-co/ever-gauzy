import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUrl } from "class-validator";
import { EmploymentDTO } from "./employment.dto";

export abstract class SocialNetworksDTO extends EmploymentDTO {
    
    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "LinkedIn must be an URL address"
    })
    readonly linkedInUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Facebook must be an URL address"
    })
    readonly facebookUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Instagram must be an URL address"
    })
    readonly instagramUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Twitter must be an URL address"
    })
    readonly twitterUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Github must be an URL address"
    })
    readonly githubUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Gitlab must be an URL address"
    })
    readonly gitlabUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Upwork must be an URL address"
    })
    readonly upworkUrl?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsUrl({}, {
        message: "Stackoverflow must be an URL address"
    })
    readonly stackoverflowUrl?: string;
}