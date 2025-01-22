import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ISMTPConfig } from '@gauzy/common';
import { ICustomSmtp, ICustomSmtpFindInput, IVerifySMTPTransport } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { TenantAwareCrudService } from './../core/crud';
import { SMTPUtils } from './../email-send/utils';
import { CustomSmtp } from './custom-smtp.entity';
import { TypeOrmCustomSmtpRepository } from './repository/type-orm-custom-smtp.repository';
import { MikroOrmCustomSmtpRepository } from './repository/mikro-orm-custom-smtp.repository';

@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		readonly typeOrmCustomSmtpRepository: TypeOrmCustomSmtpRepository,
		readonly mikroOrmCustomSmtpRepository: MikroOrmCustomSmtpRepository
	) {
		super(typeOrmCustomSmtpRepository, mikroOrmCustomSmtpRepository);
	}

	/**
	 * Retrieves SMTP settings for a given tenant/organization.
	 *
	 * @param {ICustomSmtpFindInput} query - The query parameters containing organizationId.
	 * @returns {Promise<ICustomSmtp | ISMTPConfig>} - The SMTP settings or default settings if an error occurs.
	 */
	public async getSmtpSetting(query: ICustomSmtpFindInput): Promise<ICustomSmtp | ISMTPConfig> {
		const { organizationId } = query;

		try {
			return await this.findOneByOptions({
				where: { organizationId: isEmpty(organizationId) ? IsNull() : organizationId },
				order: { createdAt: 'DESC' }
			});
		} catch {
			// Return default SMTP settings if an error occurs
			return SMTPUtils.defaultSMTPTransporter(false);
		}
	}

	/**
	 * Verifies SMTP configuration
	 *
	 * @param configuration
	 * @returns
	 */
	public async verifyTransporter(transport: IVerifySMTPTransport): Promise<boolean> {
		try {
			return !!(await SMTPUtils.verifyTransporter(transport));
		} catch (error) {
			console.log('Error while verifying nodemailer transport: %s', error?.message);
			return false;
		}
	}
}
