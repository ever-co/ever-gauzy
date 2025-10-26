import { environment } from '@gauzy/config';
import { ForbiddenException } from '@nestjs/common';

/**
 * Get the list of default user emails that should be protected from deletion in demo environment
 * These users are essential for demo functionality and should always be available
 *
 * @returns Array of protected user emails
 */
export function getDefaultProtectedUserEmails(): string[] {
	// Guard against missing or undefined demo credential config
	if (!environment.demoCredentialConfig) {
		return [];
	}
	const protectedEmails: string[] = [
		// Default Super Admin
		environment.demoCredentialConfig.superAdminEmail,

		// Default Admin
		environment.demoCredentialConfig.adminEmail,

		// Default Employee
		environment.demoCredentialConfig.employeeEmail
	];

	// Filter out undefined/null values and convert to lowercase for comparison
	return protectedEmails.filter((email) => !!email?.trim()).map((email) => email.trim().toLowerCase());
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
	return protectedEmails.includes(email.trim().toLowerCase());
}

/**
 * Validates if a user can be deleted in the current environment.
 * Throws ForbiddenException if user is protected in demo mode.
 *
 * @param email - The user email to validate
 * @throws ForbiddenException if user is protected in demo
 */
export function validateUserDeletion(email: string): void {
	if (!!environment.demo && isDefaultProtectedUser(email)) {
		throw new ForbiddenException(
			`Cannot delete default user account "${email}" in demo environment. ` +
				`This account is protected to ensure demo functionality remains available for all visitors.`
		);
	}
}
