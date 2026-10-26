import { ZitadelAccount } from './zitadel-account.entity';
import { ZitadelLogoutJti } from './zitadel-logout-jti.entity';
import { ZitadelOrganization } from './zitadel-organization.entity';
import { ZitadelSession } from './zitadel-session.entity';

export * from './zitadel-account.entity';
export * from './zitadel-logout-jti.entity';
export * from './zitadel-organization.entity';
export * from './zitadel-session.entity';

/** Every entity the plugin owns. Their tables are created by the core `AuthZitadel` migration. */
export const ZITADEL_ENTITIES = [ZitadelAccount, ZitadelOrganization, ZitadelSession, ZitadelLogoutJti];
