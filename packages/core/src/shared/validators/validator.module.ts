import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Role, UserOrganization } from "./../../core/entities/internal";
import {
    IsOrganizationShouldBelongsToConstraint,
    IsRoleAlreadyExistConstraint,
    IsRoleShouldExistConstraint
} from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Role,
            UserOrganization
        ])
    ],
    providers: [
        IsOrganizationShouldBelongsToConstraint,
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint
    ]
})
export class ValidatorModule {}