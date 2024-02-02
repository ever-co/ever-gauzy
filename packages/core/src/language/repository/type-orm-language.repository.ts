import { Repository } from 'typeorm';
import { Language } from '../language.entity';

export class TypeOrmLanguageRepository extends Repository<Language> { }