import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
    Employee,
    ExpenseCategory,
    Role,
    UserOrganization
} from "./../../core/entities/internal";
import {
    IsEmployeeBelongsToOrganizationConstraint,
    IsExpenseCategoryAlreadyExistConstraint,
    IsOrganizationBelongsToUserConstraint,
    IsRoleAlreadyExistConstraint,
    IsRoleShouldExistConstraint,
    IsTenantBelongsToUserConstraint
} from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ExpenseCategory,
            Role,
            UserOrganization,
            Employee
        ])
    ],
    providers: [
        IsExpenseCategoryAlreadyExistConstraint,
        IsOrganizationBelongsToUserConstraint,
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint,
        IsTenantBelongsToUserConstraint,
        IsEmployeeBelongsToOrganizationConstraint
    ]
})
export class ValidatorModule {}