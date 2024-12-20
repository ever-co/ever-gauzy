import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationType } from '../integration-type.entity';

@Injectable()
export class TypeOrmIntegrationTypeRepository extends Repository<IntegrationType> {
    constructor(@InjectRepository(IntegrationType) readonly repository: Repository<IntegrationType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
