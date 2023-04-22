import { IOrganizationContact, IOrganizationProject, IOrganizationTeam, ITask, ITimerToggleInput, TimeLogSourceEnum, TimeLogType } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class StartTimerDTO extends TenantOrganizationBaseDTO implements ITimerToggleInput {

    @ApiProperty({ type: () => String, enum: TimeLogType, required: true })
    @IsEnum(TimeLogType)
    readonly logType: TimeLogType;

    @ApiProperty({ type: () => String, enum: TimeLogSourceEnum, required: true })
    @IsEnum(TimeLogSourceEnum)
    readonly source: TimeLogSourceEnum;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isBillable: boolean;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly projectId: IOrganizationProject['id'];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly taskId: ITask['id'];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly organizationContactId: IOrganizationContact['id'];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly organizationTeamId: IOrganizationTeam['id'];

    /**
     * Version of the sources (Desktop/Web/Browser/Mobile) timer
     */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly version: string;
}
