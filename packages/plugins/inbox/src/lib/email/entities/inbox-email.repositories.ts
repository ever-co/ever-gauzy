import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import type { InboxProviderAccount } from './inbox-provider-account.entity';

/** The MikroORM repositories the email entities name (the services run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmInboxProviderAccountRepository extends MikroOrmBaseEntityRepository<InboxProviderAccount> {}
