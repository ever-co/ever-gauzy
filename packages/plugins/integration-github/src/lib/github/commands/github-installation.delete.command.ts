import { IntegrationTenant } from '@gauzy/core';

export class GithubInstallationDeleteCommand {
	constructor(public readonly integration: IntegrationTenant) {}
}
