export * from './lib/inbox-enabled';
export * from './lib/inbox.plugin';
export * from './lib/inbox.module';
export * from './lib/inbox.service';
export * from './lib/inbox-source-handler.registry';
export * from './lib/inbox-item-feed';
export * from './lib/inbox.constants';
export * from './lib/graphql/inbox.resolver';
export * from './lib/graphql/inbox.schema';
export * from './lib/entities/inbox-item.entity';
export * from './lib/entities/inbox-item-recipient.entity';
// The unified inbox: platform notifications filed as NOTIFICATION items, read state kept one both ways.
export * from './lib/notifications';
// The Inbox email features (plan 04 §5, Phase 4): off unless GAUZY_INBOX_EMAIL_ENABLED=true as well.
export * from './lib/email';
// Email delivery of notifications (immediate / digest, the Inbox spec FR-10–FR-12): off unless GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED=true as well.
export * from './lib/delivery';
