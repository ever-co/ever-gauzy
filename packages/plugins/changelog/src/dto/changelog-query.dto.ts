import { IChangelogFindInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

/**
 * Get changelog request DTO validation
 */
export class ChangelogQueryDTO implements IChangelogFindInput {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    readonly isFeature: boolean;
}