import { IEmployeeProposalTemplate } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { EmployeeFeatureDTO } from "@gauzy/core";
import { ProposalTemplateDTO } from "./proposal-template.dto";

/**
 * Create proposal template request DTO validation
 *
 */
export class CreateProposalTemplateDTO extends IntersectionType(
    ProposalTemplateDTO,
    EmployeeFeatureDTO
) implements IEmployeeProposalTemplate { }
