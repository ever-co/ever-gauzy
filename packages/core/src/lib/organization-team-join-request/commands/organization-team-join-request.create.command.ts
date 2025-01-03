import { ICommand } from '@nestjs/cqrs';
import { IOrganizationTeamJoinRequestCreateInput, LanguagesEnum } from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';

export class OrganizationTeamJoinRequestCreateCommand implements ICommand {
	static readonly type = '[Organization Team Join Request] Create';

	constructor(
		public readonly input: IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>,
		public readonly languageCode: LanguagesEnum
	) { }
}
