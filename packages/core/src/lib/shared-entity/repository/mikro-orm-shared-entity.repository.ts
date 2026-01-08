import { MikroOrmBaseEntityRepository } from "../../core/repository/mikro-orm-base-entity.repository";
import { SharedEntity } from "../shared-entity.entity";

export class MikroOrmSharedEntityRepository extends MikroOrmBaseEntityRepository<SharedEntity> {}
