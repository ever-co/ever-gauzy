import { IRole, IUserUpdateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional } from "class-validator";
import { CreateUserDTO } from "./create-user.dto";

/**
 * Update User DTO validation
 */
export class UpdateUserDTO extends CreateUserDTO implements IUserUpdateInput {

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly role?: IRole;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isActive?: boolean;
}