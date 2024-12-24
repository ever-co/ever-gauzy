import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SocialAccount } from '../social-account.entity';

@Injectable()
export class TypeOrmSocialAccountRepository extends Repository<SocialAccount> {}
