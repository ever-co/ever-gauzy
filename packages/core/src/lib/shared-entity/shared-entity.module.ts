import { CqrsModule } from "@nestjs/cqrs";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { CommandHandlers } from "./commands/handlers";
import { SharedEntity } from "./shared-entity.entity";
import { SharedEntityService } from "./shared-entity.service";
import { SharedEntityController } from "./shared-entity.controller";
import { SharedEntityResolver } from "./shared-entity.resolver";
import { RolePermissionModule } from "../role-permission/role-permission.module";
import { TypeOrmSharedEntityRepository } from "./repository/type-orm-shared-entity.repository";
import { MikroOrmSharedEntityRepository } from './repository/mikro-orm-shared-entity.repository';

/**
 * The sharing capability.
 *
 * `CqrsModule` is re-exported, not merely imported, because the resolver dispatches the same two
 * commands the REST controller dispatches: a resolver is a provider of whichever module hosts the
 * handler the Apollo configuration names, so a module that imports this one receives the command bus
 * only if this module hands it on.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([SharedEntity]),
        MikroOrmModule.forFeature([SharedEntity]),
        CqrsModule,
        RolePermissionModule
    ],
    controllers: [SharedEntityController],
    providers: [
        SharedEntityService,
        // The GraphQL view of the same resource.
        SharedEntityResolver,
        TypeOrmSharedEntityRepository,
        MikroOrmSharedEntityRepository,
        ...CommandHandlers
    ],
    exports: [SharedEntityService, CqrsModule]
})
export class SharedEntityModule {}