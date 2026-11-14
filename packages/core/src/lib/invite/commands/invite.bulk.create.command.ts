import { ICommand } from '@nestjs/cqrs';
import { ICreateEmailInvitesInput, ID, LanguagesEnum } from '@gauzy/contracts';

export class InviteBulkCreateCommand implements ICommand {
	static readonly type = '[Invite Bulk] Create';

	/**
	 * @param input The invitations to send.
	 * @param languageCode The language of their emails.
	 * @param placeholderEmployeeId The member without an account the invitations hand over to whoever accepts them
	 * (ever-co/ever-gauzy#11913). Set only by a claim, after its checks, never from a request body.
	 */
	constructor(
		public readonly input: ICreateEmailInvitesInput,
		public readonly languageCode: LanguagesEnum,
		public readonly placeholderEmployeeId?: ID
	) {}
}
