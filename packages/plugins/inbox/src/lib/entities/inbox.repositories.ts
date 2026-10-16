import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import type { InboxItem } from './inbox-item.entity';
import type { InboxItemRecipient } from './inbox-item-recipient.entity';

/** The MikroORM repositories the entities name (the service itself runs on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmInboxItemRepository extends MikroOrmBaseEntityRepository<InboxItem> {}

@Injectable()
export class MikroOrmInboxItemRecipientRepository extends MikroOrmBaseEntityRepository<InboxItemRecipient> {}
