import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResultUpdate } from '../keyresult-update.entity';

@Injectable()
export class TypeOrmKeyResultUpdateRepository extends Repository<KeyResultUpdate> {
    constructor(@InjectRepository(KeyResultUpdate) readonly repository: Repository<KeyResultUpdate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
