import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { SocialNetworksDTO } from "./network.dto";

export class UpdateProfileDTO extends SocialNetworksDTO {
    
    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;
}