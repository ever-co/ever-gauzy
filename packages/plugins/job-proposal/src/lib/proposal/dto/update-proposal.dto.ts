import { IntersectionType, OmitType, PartialType } from "@nestjs/mapped-types";
import { IProposalCreateInput } from "@gauzy/contracts";
import { WithoutInitializers } from "@gauzy/common";
import { RelationalTagDTO } from "@gauzy/core";
import { ProposalDTO } from "./proposal.dto";

/**
 * Update proposal request DTO validation.
 *
 * Built through `WithoutInitializers`, so a partial update does not carry `ProposalDTO`'s `status = SENT` default
 * back over the stored status (review R3-04/R3-05).
 */
export class UpdateProposalDTO extends WithoutInitializers(
    IntersectionType(PartialType(OmitType(ProposalDTO, ['valueDate'] as const)), RelationalTagDTO)
) implements IProposalCreateInput { }
