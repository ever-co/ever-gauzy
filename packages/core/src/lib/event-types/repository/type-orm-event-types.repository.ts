import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType } from '../event-type.entity';

@Injectable()
export class TypeOrmEventTypeRepository extends Repository<EventType> {
    constructor(@InjectRepository(EventType) readonly repository: Repository<EventType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
