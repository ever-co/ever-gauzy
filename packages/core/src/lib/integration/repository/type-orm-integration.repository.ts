import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';

@Injectable()
export class TypeOrmIntegrationRepository extends Repository<Integration> {
    constructor(@InjectRepository(Integration) readonly repository: Repository<Integration>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
