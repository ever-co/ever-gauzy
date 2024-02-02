import { Repository } from 'typeorm';
import { EventType } from '../event-type.entity';

export class TypeOrmEventTypeRepository extends Repository<EventType> { }
