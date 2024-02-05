import { EntityRepository } from '@mikro-orm/core';
import { CustomSmtp } from '../custom-smtp.entity';

export class MikroOrmCustomSmtpRepository extends EntityRepository<CustomSmtp> { }