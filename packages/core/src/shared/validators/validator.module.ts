import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
    Employee,
    ExpenseCategory,
    OrganizationTeam,
    Role,
    UserOrganization
} from "./../../core/entities/internal";
import {
    IsEmployeeBelongsToOrganizationConstraint,
    IsExpenseCategoryAlreadyExistConstraint,
    IsOrganizationBelongsToUserConstraint,
    IsRoleAlreadyExistConstraint,
    IsRoleShouldExistConstraint,
    IsTeamAlreadyExistConstraint,
    IsTenantBelongsToUserConstraint
} from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ExpenseCategory,
            Role,
            UserOrganization,
            Employee,
            OrganizationTeam,
        ])
    ],
    providers: [
        IsEmployeeBelongsToOrganizationConstraint,
        IsExpenseCategoryAlreadyExistConstraint,
        IsOrganizationBelongsToUserConstraint,
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint,
        IsTeamAlreadyExistConstraint,
        IsTenantBelongsToUserConstraint,
    ]
})
export class ValidatorModule {}