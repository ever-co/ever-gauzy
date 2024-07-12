import { IntersectionType, OmitType, PartialType } from "@nestjs/mapped-types";
import { IProposalCreateInput } from "@gauzy/contracts";
import { RelationalTagDTO } from "@gauzy/core";
import { ProposalDTO } from "./proposal.dto";

/**
 * Update proposal request DTO validation
 */
export class UpdateProposalDTO extends IntersectionType(
    PartialType(OmitType(ProposalDTO, ['valueDate'] as const)),
    RelationalTagDTO
) implements IProposalCreateInput { }
