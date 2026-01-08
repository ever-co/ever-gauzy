import { CqrsModule } from "@nestjs/cqrs";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { CommandHandlers } from "./commands/handlers";
import { SharedEntity } from "./shared-entity.entity";
import { SharedEntityService } from "./shared-entity.service";
import { SharedEntityController } from "./shared-entity.controller";
import { RolePermissionModule } from "../role-permission/role-permission.module";
import { TypeOrmSharedEntityRepository } from "./repository/type-orm-shared-entity.repository";

@Module({
    imports: [
        TypeOrmModule.forFeature([SharedEntity]),
        MikroOrmModule.forFeature([SharedEntity]),
        CqrsModule,
        RolePermissionModule
    ],
    controllers: [SharedEntityController],
    providers: [SharedEntityService, TypeOrmSharedEntityRepository, ...CommandHandlers]
})
export class SharedEntityModule {}
