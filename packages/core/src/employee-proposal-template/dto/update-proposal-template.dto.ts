import { IEmployeeProposalTemplate } from "@gauzy/contracts";
import { OmitType } from "@nestjs/mapped-types";
import { CreateProposalTemplateDTO } from "./create-proposal-template.dto";

export class UpdateProposalTemplateDTO extends OmitType(
    CreateProposalTemplateDTO, ['employee', 'employeeId'] as const
) implements IEmployeeProposalTemplate {}
