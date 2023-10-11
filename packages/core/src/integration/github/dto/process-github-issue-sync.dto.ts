import { IGithubIssue, IGithubSyncIssuePayload } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

/** */
export class ProcessGithubIssueSyncDTO extends TenantOrganizationBaseDTO implements IGithubSyncIssuePayload {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsArray()
    readonly issues: IGithubIssue[];
    readonly visibility: string;
}
