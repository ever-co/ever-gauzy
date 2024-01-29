import { Repository } from 'typeorm';
import { EventType } from '../event-type.entity';

export class TypeOrmEventTypesRepository extends Repository<EventType> { }
