import { IAppIntegrationConfig } from '@gauzy/common';
import { ITermsAcceptanceClaim, IUserSigninWorkspaceResponse, LanguagesEnum } from '@gauzy/contracts';

/** The registration input this plugin passes to Gauzy's own register path. */
export interface ZitadelRegistrationInput {
	user: { email: string; firstName?: string; lastName?: string };
	terms?: ITermsAcceptanceClaim[];
}

/**
 * The parts of Gauzy's authentication service the plugin uses. Provided by the core authentication
 * service itself, so the e-mail code, its rate limits and the register path are Gauzy's own.
 */
export interface GauzyAuthPort {
	/** Sends Gauzy's one-time e-mail code to every active user with this e-mail. */
	sendWorkspaceSigninCode(input: { email: string } & Partial<IAppIntegrationConfig>, locale: LanguagesEnum): Promise<void>;

	/** Checks Gauzy's one-time e-mail code (and consumes it) and returns the workspaces it proved. */
	signinWorkspacesByMagicCode(
		payload: { email: string; code: string },
		includeTeams: boolean
	): Promise<IUserSigninWorkspaceResponse>;

	/** Gauzy's register path (the one `POST /api/auth/register` runs). */
	register(input: ZitadelRegistrationInput, languageCode: LanguagesEnum): Promise<{ id: string; tenantId?: string | null }>;
}

/** Injection token of {@link GauzyAuthPort}. */
export const GAUZY_AUTH = 'AUTH_ZITADEL_GAUZY_AUTH';
