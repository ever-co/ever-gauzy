import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { ICustomSmtp, ICustomSmtpFindInput, IVerifySMTPTransport } from '@gauzy/contracts';
import { isEmpty, ISMTPConfig } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { SMTPUtils } from './../email-send/utils';
import { CustomSmtp } from './custom-smtp.entity';
import { TypeOrmCustomSmtpRepository } from './repository/type-orm-custom-smtp.repository';
import { MikroOrmCustomSmtpRepository } from './repository/mikro-orm-custom-smtp.repository';

@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		@InjectRepository(CustomSmtp)
		typeOrmCustomSmtpRepository: TypeOrmCustomSmtpRepository,

		mikroOrmCustomSmtpRepository: MikroOrmCustomSmtpRepository
	) {
		super(typeOrmCustomSmtpRepository, mikroOrmCustomSmtpRepository);
	}

	/**
	 * GET SMTP settings for tenant/organization
	 *
	 * @param query
	 * @returns
	 */
	public async getSmtpSetting(query: ICustomSmtpFindInput): Promise<ICustomSmtp | ISMTPConfig> {
		try {
			const { organizationId } = query;
			return await this.findOneByOptions({
				where: {
					organizationId: isEmpty(organizationId) ? IsNull() : organizationId
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
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
