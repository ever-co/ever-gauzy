import { ApiPropertyOptional, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { IImageAsset, IOrganizationTeam } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { RelationalTagDTO } from "./../../tags/dto";

export class OrganizationTeamDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    PartialType(RelationalTagDTO),
) implements Omit<IOrganizationTeam, 'name'> {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly logo: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly prefix?: string;

    /**
     * Team type should be boolean true/false
     */
    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly public?: boolean;

    @ApiPropertyOptional({ type: () => String, isArray: true })
    @IsOptional()
    @IsArray()
    readonly memberIds?: string[] = [];

    @ApiPropertyOptional({ type: () => String, isArray: true })
    @IsOptional()
    @IsArray()
    readonly managerIds?: string[] = [];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly imageId?: IImageAsset['id'];
}
