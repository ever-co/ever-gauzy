import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import {
    Role,
    Employee,
    OrganizationTeam,
    ExpenseCategory,
    UserOrganization
} from "./../../core/entities/internal";
import {
    TenantBelongsToUserConstraint,
    RoleAlreadyExistConstraint,
    RoleShouldExistConstraint,
    EmployeeBelongsToOrganizationConstraint,
    TeamAlreadyExistConstraint,
    ExpenseCategoryAlreadyExistConstraint,
    OrganizationBelongsToUserConstraint
} from "./constraints";

const entities = [
    Role,
    Employee,
    OrganizationTeam,
    ExpenseCategory,
    UserOrganization
];

@Module({
    imports: [
        TypeOrmModule.forFeature(entities),
        MikroOrmModule.forFeature(entities)
    ],
    providers: [
        TenantBelongsToUserConstraint,
        RoleAlreadyExistConstraint,
        RoleShouldExistConstraint,
        EmployeeBelongsToOrganizationConstraint,
        TeamAlreadyExistConstraint,
        ExpenseCategoryAlreadyExistConstraint,
        OrganizationBelongsToUserConstraint
    ],
    exports: [TypeOrmModule, MikroOrmModule]
})
export class ValidatorModule { }
