import { PartialType } from "@nestjs/mapped-types";
import { UpdateProposalDTO } from ".";

export class UpdateProposalActionDTO extends PartialType(UpdateProposalDTO) {}