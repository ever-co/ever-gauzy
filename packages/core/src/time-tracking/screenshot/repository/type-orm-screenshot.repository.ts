import { Repository } from 'typeorm';
import { Screenshot } from '../screenshot.entity';

export class TypeOrmScreenshotRepository extends Repository<Screenshot> { }