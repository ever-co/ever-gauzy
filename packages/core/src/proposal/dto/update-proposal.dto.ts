import { IProposalCreateInput } from "@gauzy/contracts";
import { IntersectionType, OmitType, PartialType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { ProposalDTO } from "./proposal.dto";

/**
 * Update proposal request DTO validation
 */
export class UpdateProposalDTO extends IntersectionType(
    PartialType(OmitType(ProposalDTO, ['valueDate'] as const)),
    RelationalTagDTO
) implements IProposalCreateInput {}