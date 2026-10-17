import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import type { InboxEmail } from './inbox-email.entity';
import type { InboxEmailAttachment } from './inbox-email-attachment.entity';
import type { InboxEmailThread } from './inbox-email-thread.entity';
import type { InboxMailbox } from './inbox-mailbox.entity';
import type { InboxMailboxMember } from './inbox-mailbox-member.entity';
import type { InboxOrganizationSetting } from './inbox-organization-setting.entity';
import type { InboxProviderAccount } from './inbox-provider-account.entity';

/** The MikroORM repositories the email entities name (the services run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmInboxProviderAccountRepository extends MikroOrmBaseEntityRepository<InboxProviderAccount> {}

@Injectable()
export class MikroOrmInboxMailboxRepository extends MikroOrmBaseEntityRepository<InboxMailbox> {}

@Injectable()
export class MikroOrmInboxMailboxMemberRepository extends MikroOrmBaseEntityRepository<InboxMailboxMember> {}

@Injectable()
export class MikroOrmInboxEmailThreadRepository extends MikroOrmBaseEntityRepository<InboxEmailThread> {}

@Injectable()
export class MikroOrmInboxEmailRepository extends MikroOrmBaseEntityRepository<InboxEmail> {}

@Injectable()
export class MikroOrmInboxEmailAttachmentRepository extends MikroOrmBaseEntityRepository<InboxEmailAttachment> {}

@Injectable()
export class MikroOrmInboxOrganizationSettingRepository extends MikroOrmBaseEntityRepository<InboxOrganizationSetting> {}
