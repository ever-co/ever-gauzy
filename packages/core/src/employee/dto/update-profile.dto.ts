import { IEmployeeUpdateInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { SocialNetworksDTO } from "./network.dto";

export class UpdateProfileDTO extends SocialNetworksDTO implements IEmployeeUpdateInput {
    
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly profile_link?: string;
}