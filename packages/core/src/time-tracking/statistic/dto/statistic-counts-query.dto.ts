import { IGetCountsStatistics } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { FiltersQueryDTO, SelectorsQueryDTO } from "./../../../shared/dto";

/**
 * Get statistic counts request DTO validation
 */
export class StatisticCountsQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    SelectorsQueryDTO
) implements IGetCountsStatistics {}