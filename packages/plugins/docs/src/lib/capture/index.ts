/**
 * Capture channels (`07-ai-knowledge.md` §17) — the provider-based seams through which
 * documents arrive from outside the Documents UI: integration importers, inbound email,
 * and AI-chat attachments. Every channel produces ordinary `document` rows that then ride
 * the standard pipeline unchanged, and none of them auto-imports into AI knowledge.
 */
export * from './document-importer.interface';
export * from './inbound-email.types';
export * from './generic-signed-webhook.adapter';
export * from './inbound-email.service';
export * from './inbound-email.controller';
export * from './chat-capture.subscriber';
