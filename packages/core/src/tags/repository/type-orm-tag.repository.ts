import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from '../tag.entity';

@Injectable()
export class TypeOrmTagRepository extends Repository<Tag> {
    constructor(@InjectRepository(Tag) readonly repository: Repository<Tag>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
