import { IntersectionType } from "@nestjs/swagger";
import { PickType } from "@nestjs/mapped-types";
import { FindMeQueryDTO } from "../../user/dto";

/**
 * DTO (Data Transfer Object) for finding user organization with "Find Me" query parameters.
 */
export class FindMeUserOrganizationDTO extends IntersectionType(
    PickType(FindMeQueryDTO, ['includeEmployee'] as const),
) { }
