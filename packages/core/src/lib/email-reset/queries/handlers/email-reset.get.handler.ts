import { NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { IEmailReset } from '@gauzy/contracts';
import { EmailResetGetQuery } from '../email-reset.get.query';
import { EmailResetService } from '../../email-reset.service';

@QueryHandler(EmailResetGetQuery)
export class EmailResetGetHandler implements IQueryHandler<EmailResetGetQuery> {
	constructor(private readonly _emailResetService: EmailResetService) {}

	public async execute(query: EmailResetGetQuery): Promise<IEmailReset> {
		const { input } = query;

		try {
			return await this._emailResetService.getEmailResetIfCodeMatches(
				input
			);
		} catch (error) {
			throw new NotFoundException(error);
		}
	}
}
