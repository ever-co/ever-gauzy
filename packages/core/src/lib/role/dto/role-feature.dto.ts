import { IRelationalRole, IRole } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { IsRoleReference, IsRoleShouldExist } from "./../../shared/validators";

export class RoleFeatureDTO implements IRelationalRole  {

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.role)
    @IsNotEmpty()
    @IsRoleShouldExist({
        message: 'RoleId {$value} should be exist for this tenant.'
    })
    readonly roleId: string;

    /**
     * The role as an object carrying its `id` — never a bare id string (send `roleId` for that).
     *
     * It is validated whenever it is SENT, not only when `roleId` is absent: with the old
     * `ValidateIf(!roleId)` a body pairing a harmless `roleId` with any `role` value skipped every
     * validator on `role` (GHSA-x4mv-fhwj-g3rp).
     */
    @ApiProperty({ type: () => Object, description: 'Role reference: an object with the role `id` (UUID).' })
    @ValidateIf((it) => !it.roleId || (it.role !== undefined && it.role !== null))
    @IsNotEmpty()
    @IsRoleReference()
    @IsRoleShouldExist({
        message: 'Role should be exist for this tenant.'
    })
    readonly role: IRole;
}