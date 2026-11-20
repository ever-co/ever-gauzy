import { Inject, Injectable } from '@nestjs/common';
import { EverOperatorCandidate, EverOperatorService } from '@gauzy/plugin-ever-instance';
import type { EverConnectConfig } from './ever-connect-config';
import { EVER_CONNECT_SETTINGS } from './ever-connect.constants';

/** What an operator check of this module needs: `EverConnectOperatorService`, or the shared service in a spec. */
export interface OperatorCheck {
	isOperator(user: EverOperatorCandidate | null | undefined, roleName: string | null | undefined): Promise<boolean>;
}

/**
 * Who operates the Ever Platform connection of this installation.
 *
 * - **Not on Ever's cloud:** the operator of the installation (`EverOperatorService`, shared with the
 *   anonymous statistics): a super admin named in `EVER_OPERATOR_USER_IDS` or `EVER_OPERATOR_EMAILS`,
 *   or the first super admin of a single-tenant installation.
 * - **On Ever's cloud** (`EVER_INSTALL_SOURCE=cloud`), where any tenant's super admin is only that,
 *   a super admin whose user id is listed in `EVER_CONNECT_CLOUD_OPERATOR_USER_IDS` (by id only,
 *   checked against the database now). Unset, nobody, as before. The statistics module's operator
 *   routes are not opened by it.
 */
@Injectable()
export class EverConnectOperatorService implements OperatorCheck {
	constructor(
		private readonly operator: EverOperatorService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig
	) {}

	async isOperator(
		user: EverOperatorCandidate | null | undefined,
		roleName: string | null | undefined
	): Promise<boolean> {
		if (this.config.cloud) {
			return this.operator.isListedSuperAdmin(user, roleName, this.config.cloudOperatorUserIds);
		}
		return this.operator.isOperator(user, roleName);
	}
}
