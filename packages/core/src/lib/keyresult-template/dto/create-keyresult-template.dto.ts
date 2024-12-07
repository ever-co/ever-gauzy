import { IntersectionType } from '@nestjs/mapped-types';
import { RelationalGoalKpiTemplateDTO } from '../../goal-kpi-template/dto';
import { RelationalGoalTemplateDTO } from '../../goal-template/dto';
import { KeyresultTemplateDTO } from './keyresult-template.dto';

export class CreateKeyresultTemplateDTO extends IntersectionType(
	KeyresultTemplateDTO,
	RelationalGoalTemplateDTO,
	RelationalGoalKpiTemplateDTO
) {}
