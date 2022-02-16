import { IntersectionType } from "@nestjs/mapped-types";
import { GoalBaseDTO, KpiBaseDTO } from "core/dto";
import { KeyresultTemplateDTO } from "./keyresult-template.dto";

export class CreateKeyresultTemplateDTO extends IntersectionType ( 
    KeyresultTemplateDTO, GoalBaseDTO, KpiBaseDTO) {}