import { createToken } from './create-token';

// Tokens used for dependency injection
export const TokenRepositoryToken = createToken('Token Repository Token');
export const TokenReadRepositoryToken = createToken('Token Read Repository Token');
export const TokenWriteRepositoryToken = createToken('Token Write Repository Token');
export const TokenMaintenanceRepositoryToken = createToken('Token Maintenance Repository Token');
