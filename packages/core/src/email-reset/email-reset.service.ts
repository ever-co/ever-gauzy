import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from 'core';
import { Repository } from 'typeorm';
import { EmailReset } from './email-reset.entity';

@Injectable()
export class EmailResetService extends CrudService<EmailReset> {
    constructor(
		@InjectRepository(EmailReset)
		private readonly _emailResetRepository: Repository<EmailReset>
	) {
		super(_emailResetRepository);
	}
}
