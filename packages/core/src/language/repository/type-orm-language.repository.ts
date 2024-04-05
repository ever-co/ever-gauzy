import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Language } from '../language.entity';

@Injectable()
export class TypeOrmLanguageRepository extends Repository<Language> {
    // constructor(@InjectRepository(Language) readonly repository: Repository<Language>) {
    //     super(repository.target, repository.manager, repository.queryRunner);
    // }
}
