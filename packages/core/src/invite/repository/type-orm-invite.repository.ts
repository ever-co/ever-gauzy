import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from '../invite.entity';

@Injectable()
export class TypeOrmInviteRepository extends Repository<Invite> {
    constructor(@InjectRepository(Invite) readonly repository: Repository<Invite>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
