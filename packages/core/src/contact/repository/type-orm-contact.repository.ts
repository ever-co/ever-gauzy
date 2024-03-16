import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../contact.entity';

export class TypeOrmContactRepository extends Repository<Contact> {
    constructor(
        @InjectRepository(Contact) readonly repository: Repository<Contact>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
