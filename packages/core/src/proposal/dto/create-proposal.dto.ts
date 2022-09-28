import { IProposalCreateInput } from "@gauzy/contracts";
import { IntersectionType, PartialType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { ProposalDTO } from "./proposal.dto";

/**
 * Create proposal request DTO validation
 */
export class CreateProposalDTO extends IntersectionType(
    ProposalDTO,
    PartialType(EmployeeFeatureDTO),
    RelationalTagDTO
) implements IProposalCreateInput {}