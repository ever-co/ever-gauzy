import { ITermsAcceptanceDocument } from '@gauzy/contracts';

/**
 * The legal documents Gauzy currently requires a new account to accept. Provided by Gauzy's own terms
 * acceptance service, so the Ever ID sign-up requires exactly what the register form requires.
 */
export interface TermsDocumentsPort {
	getRequiredDocuments(locale?: string): ITermsAcceptanceDocument[];
}

/** Injection token of {@link TermsDocumentsPort}. */
export const TERMS_DOCUMENTS = 'AUTH_ZITADEL_TERMS_DOCUMENTS';
