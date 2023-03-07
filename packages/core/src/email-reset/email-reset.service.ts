import { CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IChangeEmailRequest, IEmailReset, LanguagesEnum } from '@gauzy/contracts';

import { RequestContext } from '../core/context';
import { UserService } from '../user/user.service';
import { TenantAwareCrudService } from '../core/crud';
import { EmailReset } from './email-reset.entity';
import { UserEmailDTO } from '../user/dto';
import { generateRandomInteger } from './../core/utils';
import {
	EmailResetCreateCommand, EmailResetGetCommand
} from './commands'
import { VerifyEmailResetRequestDTO } from './dto/verify-email-reset-request.dto';

@Injectable()
export class EmailResetService extends TenantAwareCrudService<EmailReset> {

	constructor(
		@InjectRepository(EmailReset)
		private readonly _emailResetRepository: Repository<EmailReset>,
		private readonly userService: UserService,
		private readonly commandBus: CommandBus
	) {
		super(_emailResetRepository);
	}

	async requestChangeEmail(
		request: UserEmailDTO,
		languageCode: LanguagesEnum
	){
		const user = RequestContext.currentUser();

		/**
		 * User with email already exist
		 */
		if(user.email === request.email || (await this.userService.checkIfExistsEmail(request.email))){
			throw new BadRequestException('Oops, the email exists, please try with another email');
		}


		await this.commandBus.execute(
			new EmailResetCreateCommand({
				code: generateRandomInteger(6),
				email: request.email,
				oldEmail: user.email,
				userId: user.id
			})
		);

		return true		
	}

	async verifyCode(request: VerifyEmailResetRequestDTO){
		try {
			const { code } = request;
			const user = RequestContext.currentUser()

			const record: IEmailReset = await this.commandBus.execute(
				new EmailResetGetCommand({
					code,
					userId: user.id
				})
			);
			
			if (!record) {
				throw new BadRequestException('Email Reset Failed.');
			}

			await this.userService.update({
				id: record.userId
			}, {
				email: record.email
			})

			return true
		} catch (error) {
			throw new BadRequestException('Email Reset Failed.')
		}
	}
}
