import { IQuery } from '@nestjs/cqrs';
import { IDateRangePicker, IOrganizationTeam, IOrganizationTeamStatisticInput } from '@gauzy/contracts';

export class GetOrganizationTeamStatisticQuery implements IQuery {
	static readonly type = 'Get [Organization Team] Statistic';

	constructor(
		public readonly organizationTeamId: IOrganizationTeam['id'],
		public readonly query: IOrganizationTeamStatisticInput & IDateRangePicker
	) { }
}
