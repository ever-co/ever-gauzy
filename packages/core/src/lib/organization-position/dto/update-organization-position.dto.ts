import { IOrganizationPosition } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { OrganizationPositionDTO } from "./organization-position.dto";

/**
 * Organization Position Update DTO
 * 
 */
export class UpdateOrganizationPositionDTO extends IntersectionType(
    OrganizationPositionDTO,
    RelationalTagDTO
) implements IOrganizationPosition {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsString()
    @IsNotEmpty()
    readonly name: string;
}