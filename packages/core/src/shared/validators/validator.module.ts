import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
    ExpenseCategory,
    Role,
    UserOrganization
} from "./../../core/entities/internal";
import {
    IsExpenseCategoryAlreadyExistConstraint,
    IsOrganizationShouldBelongsToConstraint,
    IsRoleAlreadyExistConstraint,
    IsRoleShouldExistConstraint
} from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ExpenseCategory,
            Role,
            UserOrganization
        ])
    ],
    providers: [
        IsExpenseCategoryAlreadyExistConstraint,
        IsOrganizationShouldBelongsToConstraint,
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint,
    ]
})
export class ValidatorModule {}