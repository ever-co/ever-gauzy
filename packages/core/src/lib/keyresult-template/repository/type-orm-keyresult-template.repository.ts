import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResultTemplate } from '../keyresult-template.entity';

@Injectable()
export class TypeOrmKeyResultTemplateRepository extends Repository<KeyResultTemplate> {
    constructor(@InjectRepository(KeyResultTemplate) readonly repository: Repository<KeyResultTemplate>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
