import {
	ICustomSmtp,
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { CustomSmtp } from './custom-smtp.entity';
@Injectable()
export class CustomSmtpService extends TenantAwareCrudService<CustomSmtp> {
	constructor(
		@InjectRepository(CustomSmtp)
		private readonly customSmtpRepository: Repository<CustomSmtp>
	) {
		super(customSmtpRepository);
	}

	async getSmtpSetting(query: ICustomSmtpFindInput): Promise<ICustomSmtp> {
		const { tenantId, organizationId } = query;
		if (!organizationId) {
			return await this.customSmtpRepository.findOne({
				where: {
					tenantId,
					organizationId: IsNull()
				}
			});
		}
		return await this.customSmtpRepository.findOne({
			where: {
				tenantId,
				organizationId: organizationId
			}
		});
	}

	// Verify connection configuration
	async verifyTransporter(configuration: ICustomSmtpCreateInput) {
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
						console.log('Server is ready to take our messages');
						resolve(true);
					}
				});
			} catch (error) {
				reject(false);
			}
		});
	}
}
