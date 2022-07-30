import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Role } from "./../../core/entities/internal";
import { IsRoleAlreadyExistConstraint, IsRoleShouldExistConstraint } from "./constraints";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Role
        ])
    ],
    providers: [
        IsRoleAlreadyExistConstraint,
        IsRoleShouldExistConstraint
    ]
})
export class ValidatorModule {}