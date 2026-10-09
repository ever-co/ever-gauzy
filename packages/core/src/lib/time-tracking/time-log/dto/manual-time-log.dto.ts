import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { ID, IEmployee, IManualTimeInput } from "@gauzy/contracts";
import { IsBeforeDate } from "./../../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

/**
 * Data transfer object for creating or updating ManualTimeLog entities.
 */
export class ManualTimeLogDTO extends TenantOrganizationBaseDTO implements IManualTimeInput {

    /**
     * The start date and time of the manual time log.
     */
    @ApiProperty({ type: () => Date })
    @IsNotEmpty({ message: "Started date should not be empty" })
    @IsBeforeDate(ManualTimeLogDTO, (it) => it.stoppedAt, {
        message: "Started date must be before stopped date"
    })
    startedAt: Date;

    /**
     * The end date and time of the manual time log.
     */
    @ApiProperty({ type: () => Date })
    @IsNotEmpty({ message: "Stopped date should not be empty" })
    stoppedAt: Date;

    /**
     * The ID of the employee associated with the manual time log.
     */
    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsUUID()
    employeeId: IEmployee['id'];

    /*
     * The fields below are what the web and desktop clients send besides the dates (the edit-time-log
     * modal and the timer's `timerConfig`). They are declared so the routes can run with
     * `whitelist: true`, which keeps everything else (id, isRunning, timesheetId, relation objects)
     * out of the time log (GHSA-6qvm-3wg4-26w4). Ids are validated as strings, not UUIDs, because the
     * clients send them as-is and an empty value must not start failing.
     */

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    projectId?: ID;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    taskId?: ID;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    organizationContactId?: ID;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    organizationTeamId?: ID;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isBillable?: boolean;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    tags?: string[];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    version?: string;
}
