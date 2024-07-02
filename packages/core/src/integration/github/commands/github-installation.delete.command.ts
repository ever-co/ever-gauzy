import { IIntegrationTenant } from '@gauzy/contracts';

export class GithubInstallationDeleteCommand {
	constructor(public readonly integration: IIntegrationTenant) {}
}
