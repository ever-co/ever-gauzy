import { IContact, IEmployeeUpdateInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { SocialNetworksDTO } from "./network.dto";

export class UpdateProfileDTO extends SocialNetworksDTO implements IEmployeeUpdateInput {
    
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly contact?: IContact;
}