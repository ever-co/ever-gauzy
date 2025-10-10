import { environment } from '@gauzy/config';

/**
 * Get the list of default user emails that should be protected from deletion in demo environment
 * These users are essential for demo functionality and should always be available
 *
 * @returns Array of protected user emails
 */
export function getDefaultProtectedUserEmails(): string[] {
	const protectedEmails: string[] = [
		// Default Super Admin
		environment.demoCredentialConfig.superAdminEmail,

		// Default Admin
		environment.demoCredentialConfig.adminEmail,

		// Default Employee
		environment.demoCredentialConfig.employeeEmail
	];

	// Filter out undefined/null values and convert to lowercase for comparison
	return protectedEmails.filter((email) => email != null && email !== '').map((email) => email.toLowerCase());
}

/**
 * Check if a user email is a default protected user
 *
 * @param email - The user email to check
 * @returns true if the email is in the protected list
 */
export function isDefaultProtectedUser(email: string): boolean {
	if (!email) {
		return false;
	}

	const protectedEmails = getDefaultProtectedUserEmails();
	return protectedEmails.includes(email.toLowerCase());
}
