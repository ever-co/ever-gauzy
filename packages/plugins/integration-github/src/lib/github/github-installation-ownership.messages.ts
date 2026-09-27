import { environment } from '@gauzy/config';

/**
 * The install arrived without an OAuth code, so nobody can say which GitHub user completed it. That
 * happens exactly when the GitHub App does not request user authorization during installation
 * (GHSA-4rwq-65wh-45h4), so the message names the one setting that fixes it.
 */
export function githubInstallationCodeMissingMessage(): string {
	const callbackUrl = `${environment.baseUrl}/api/integration/github/callback`;
	return (
		'GitHub did not identify who completed this installation, so it was not connected. ' +
		'An administrator must enable "Request user authorization (OAuth) during installation" on the GitHub App ' +
		`and set its first Callback URL to ${callbackUrl}. Then connect GitHub again.`
	);
}

/** The code was valid, but that GitHub user is not entitled to the whole installation. */
export function githubInstallationNotEntitledMessage(): string {
	return (
		'This GitHub installation was not connected: the GitHub account that authorized it must own it, ' +
		'or — for an organization — have access to every repository it covers. ' +
		'Ask an owner of that GitHub account or organization to connect it.'
	);
}
