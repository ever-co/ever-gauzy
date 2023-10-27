import { IGithubIssue, IGithubRepository, IGithubSyncIssuePayload, IOrganizationProject } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsUUID } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

/**
 * Data Transfer Object for processing GitHub issue synchronization.
 *
 * This DTO provides optional properties to handle GitHub issues and repositories during synchronization.
 */
export class ProcessGithubIssueSyncDTO extends TenantOrganizationBaseDTO implements IGithubSyncIssuePayload {
    /** Optional array of GitHub issues to synchronize. */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsArray()
    readonly issues: IGithubIssue[];

    /** Optional GitHub repository for synchronization. */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsObject()
    readonly repository: IGithubRepository;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly projectId: IOrganizationProject['id'];
}
