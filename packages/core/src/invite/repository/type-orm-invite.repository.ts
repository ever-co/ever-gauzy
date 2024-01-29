import { Repository } from 'typeorm';
import { Invite } from '../invite.entity';

export class TypeOrmInviteRepository extends Repository<Invite> { }