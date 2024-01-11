import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
    Role,
    Employee,
    OrganizationTeam,
    ExpenseCategory,
    UserOrganization
} from "./../../core/entities/internal";
import {
    IsTenantBelongsToUserConstraint,
    IsRoleAlreadyExistConstraint,
    IsRoleShouldExistConstraint,
    IsEmployeeBelongsToOrganizationConstraint,
    IsTeamAlreadyExistConstraint,
    IsExpenseCategoryAlreadyExistConstraint,
    IsOrganizationBelongsToUserConstraint
} from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Role,
            Employee,
            OrganizationTeam,
            ExpenseCategory
        ]),
        forwardRef(() => TypeOrmModule.forFeature([
            UserOrganization
        ]))
    ],
    providers: [
        IsTenantBelongsToUserConstraint,
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint,
        IsEmployeeBelongsToOrganizationConstraint,
        IsTeamAlreadyExistConstraint,
        IsExpenseCategoryAlreadyExistConstraint,
        IsOrganizationBelongsToUserConstraint
    ],
    exports: [TypeOrmModule]
})
export class ValidatorModule { }
