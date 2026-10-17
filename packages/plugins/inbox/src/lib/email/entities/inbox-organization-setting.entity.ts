import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxOrganizationSettingRepository } from './inbox-email.repositories';

/**
 * `inbox_organization_setting` (plan 04 §5.1, G-P4-1): an organization's Inbox email settings, one row per
 * organization: whether every new employee gets a mailbox (agent employees never do).
 */
@MultiORMEntity('inbox_organization_setting', { mikroOrmRepository: () => MikroOrmInboxOrganizationSettingRepository })
export class InboxOrganizationSetting extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ default: false })
	autoProvisionEmployees!: boolean;
}
