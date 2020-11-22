import { ICustomSmtp } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

	async getTenantSmtpSetting(tenantId: string): Promise<ICustomSmtp> {
		return await this.customSmtpRepository.findOne({
			where: { tenantId }
		});
	}
}
