import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Role } from "./../../../core/entities/internal";
import { IsRoleAlreadyExistConstraint } from "./is-role-already-exist.decorator";
import { IsRoleShouldExistConstraint } from "./is-role-should-exist.decorator";

@Module({
    imports: [TypeOrmModule.forFeature([Role])],
    providers: [
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint
    ]
})
export class ValidatorModule {}