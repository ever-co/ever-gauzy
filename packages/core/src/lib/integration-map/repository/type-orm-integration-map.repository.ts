import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationMap } from '../integration-map.entity';

@Injectable()
export class TypeOrmIntegrationMapRepository extends Repository<IntegrationMap> {
    constructor(@InjectRepository(IntegrationMap) readonly repository: Repository<IntegrationMap>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
