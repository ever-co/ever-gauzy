import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import {
	ICustomSmtp,
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput
} from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
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
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = query;
		
		const globalSmtp = this.defaultSMTPTransporter();
		delete globalSmtp['auth'];
	
		try {
			if (!organizationId) {
				const tenantSmtp = await this.findOneByOptions({
					where: {
						tenantId,
						organizationId: IsNull()
					}
				});
				return tenantSmtp || globalSmtp;
			}
			const organizationSmtp = await this.findOneByOptions({
				where: {
					tenantId,
					organizationId
				}
			});
			return organizationSmtp || globalSmtp;
		} catch {
			return globalSmtp;
		}
	}

	// Verify connection configuration
	public async verifyTransporter(configuration: ICustomSmtpCreateInput) {
		return new Promise((resolve, reject) => {
			try {
				const transporter = nodemailer.createTransport({
					host: configuration.host,
					port: configuration.port || 587,
					secure: configuration.secure || false, // use TLS
					auth: {
						user: configuration.username,
						pass: configuration.password
					}
				});
				transporter.verify(function (error, success) {
					if (error) {
						console.log(error);
						reject(false);
					} else {
						resolve(true);
					}
				});
			} catch (error) {
				reject(false);
			}
		});
	}

	/*
	 * This example would connect to a SMTP server separately for every single message
	 */
	public defaultSMTPTransporter(): ISMTPConfig {
		const smtp: ISMTPConfig = env.smtpConfig;
		return {
			host: smtp.host,
			port: smtp.port,
			secure: smtp.secure, // true for 465, false for other ports
			auth: {
				user: smtp.auth.user,
				pass: smtp.auth.pass
			}
		};
	}
}
