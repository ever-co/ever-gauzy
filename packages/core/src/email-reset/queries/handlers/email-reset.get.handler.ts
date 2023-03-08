import { NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { EmailResetGetQuery } from '../email-reset.get.query';
import { EmailResetService } from '../../email-reset.service';
import { IEmailReset } from '@gauzy/contracts';

@QueryHandler(EmailResetGetQuery)
export class EmailResetGetHandler implements IQueryHandler<EmailResetGetQuery> {
	constructor(private readonly _emailResetService: EmailResetService) {}

	public async execute(query: EmailResetGetQuery): Promise<IEmailReset> {
		const { input } = query;
		const { email, oldEmail, userId, code } = input;

		try {
			return await this._emailResetService.findOneByOptions({
				where: {
					email,
					oldEmail,
					userId,
					code
				},
				order: {
					createdAt: 'DESC'
				}
			});
		} catch (error) {
			throw new NotFoundException(error);
		}
	}
}
