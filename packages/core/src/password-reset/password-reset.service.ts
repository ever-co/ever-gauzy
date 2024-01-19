import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from './../core/crud';
import { PasswordReset } from './password-reset.entity';

@Injectable()
export class PasswordResetService extends CrudService<PasswordReset> {
	constructor(
		@InjectRepository(PasswordReset)
		private readonly passwordResetRepository: Repository<PasswordReset>,
		@MikroInjectRepository(PasswordReset)
		private readonly mikroPasswordResetRepository: EntityRepository<PasswordReset>
	) {
		super(passwordResetRepository, mikroPasswordResetRepository);
	}
}
