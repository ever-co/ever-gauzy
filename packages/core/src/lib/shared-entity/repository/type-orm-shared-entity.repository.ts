import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SharedEntity } from "../shared-entity.entity";

@Injectable()
export class TypeOrmSharedEntityRepository extends Repository<SharedEntity> {
    constructor(@InjectRepository(SharedEntity) readonly repository: Repository<SharedEntity>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
