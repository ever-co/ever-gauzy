import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { IOrganizationTeamStatisticInput } from "@gauzy/contracts";
import { TimerStatusQueryDTO } from "./../../time-tracking/timer/dto";
/**
 * Get team statistic request DTO validation
 */
export class OrganizationTeamStatisticDTO extends PartialType(TimerStatusQueryDTO)
    implements IOrganizationTeamStatisticInput {

    /**
	* Indicates if last worked task row should be included in entity result.
	*/
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	readonly withLaskWorkedTask: boolean;
}