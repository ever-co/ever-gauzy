import { Repository } from 'typeorm';
import { Activity } from '../activity.entity';

export class TypeOrmActivityRepository extends Repository<Activity> { }