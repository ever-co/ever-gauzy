import { IntersectionType, OmitType, PartialType } from "@nestjs/mapped-types";
import { RelationsQueryDTO } from "./../../shared/dto";
import { CreateFeatureToggleDTO } from "./create-feature-toggle.dto";

/**
 * GET feature organization query request DTO validation
 */
export class FeatureOrganizationQueryDTO extends IntersectionType(
    RelationsQueryDTO,
    PartialType(
        OmitType(
            CreateFeatureToggleDTO,
            ['isEnabled'] as const
        )
    )
) {}