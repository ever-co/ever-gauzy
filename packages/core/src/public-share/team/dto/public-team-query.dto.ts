import { IBaseRelationsEntityModel, IDateRangePicker } from "@gauzy/contracts";
import { IntersectionType, PickType } from "@nestjs/swagger";
import { DateRangeQueryDTO, RelationsQueryDTO } from "./../../../shared/dto";

export class PublicTeamQueryDTO extends IntersectionType(
    PickType(DateRangeQueryDTO, ['startDate', 'endDate']),
    RelationsQueryDTO
) implements IDateRangePicker, IBaseRelationsEntityModel { }
