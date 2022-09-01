import { ICreateEmailInvitesInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RoleFeatureDTO } from "./../../role/dto";
import { InviteDTO } from "./invite.dto";

/**
 * Create Invite DTO validation
 */
export class CreateInviteDTO extends IntersectionType(
    InviteDTO,
    RoleFeatureDTO
) implements ICreateEmailInvitesInput {}