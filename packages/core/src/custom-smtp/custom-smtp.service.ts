import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ICustomSmtp, ICustomSmtpFindInput, IVerifySMTPTransport } from '@gauzy/contracts';
import { isEmpty, ISMTPConfig } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { SMTPUtils } from './../email-send/utils';
import { CustomSmtp } from './custom-smtp.entity';

@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		@InjectRepository(CustomSmtp)
		protected readonly customSmtpRepository: Repository<CustomSmtp>
	) {
		super(customSmtpRepository);
	}

	/**
	 * GET SMTP settings for tenant/organization
	 *
	 * @param query
	 * @returns
	 */
	public async getSmtpSetting(
		query: ICustomSmtpFindInput
	): Promise<ICustomSmtp | ISMTPConfig> {
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
			return !!await SMTPUtils.verifyTransporter(transport);
		} catch (error) {
			console.log('Error while verifying nodemailer transport: %s', error?.message);
			return false;
		}
	}
}
