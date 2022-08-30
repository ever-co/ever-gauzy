import { IProposalCreateInput } from "@gauzy/contracts";
import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateProposalDTO } from "./create-proposal.dto";

/**
 * Update proposal request DTO validation
 */
export class UpdateProposalDTO extends PartialType(
    OmitType(
        CreateProposalDTO,
        ['valueDate', 'employee', 'employeeId'] as const
    )
) implements IProposalCreateInput {}