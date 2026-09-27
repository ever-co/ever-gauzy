import { environment } from '@gauzy/config';

/**
 * Why `POST /install` refused to bind an installation, keyed by the reason the post-install callback
 * reported (`install_check`). The reason only chooses the wording: the refusal itself rests on the
 * missing or invalid proof (GHSA-4rwq-65wh-45h4).
 */
export function githubInstallationRefusedMessage(reason?: string): string {
	switch (reason) {
		case 'not_entitled':
			return (
				'This GitHub installation was not connected: the GitHub account that authorized it must own it, ' +
				'or, for an organization, have access to every repository it covers. ' +
				'Ask an owner of that GitHub account or organization to connect it.'
			);
		case 'unverifiable':
			return (
				'This GitHub installation could not be verified right now: GitHub was unreachable, or the API is missing ' +
				'GAUZY_GITHUB_CLIENT_ID / GAUZY_GITHUB_CLIENT_SECRET. Please try connecting GitHub again, or contact an administrator.'
			);
		default: {
			const callbackUrl = `${environment.baseUrl}/api/integration/github/callback`;
			return (
				'GitHub did not identify who completed this installation, so it was not connected. ' +
				'An administrator must enable "Request user authorization (OAuth) during installation" on the GitHub App ' +
				`and set its first Callback URL to ${callbackUrl}. Then connect GitHub again.`
			);
		}
	}
}
