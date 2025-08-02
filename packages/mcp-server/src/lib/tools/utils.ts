import { authManager } from '../common/auth-manager';

/**
 * Helper function to validate organization context and return default parameters
 */
export const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};