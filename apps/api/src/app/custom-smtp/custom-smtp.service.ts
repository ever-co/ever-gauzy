import { ICustomSmtp, ICustomSmtpFindInput } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
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
}
