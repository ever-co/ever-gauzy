/**
 * Interface for password hashing strategies (Strategy Pattern).
 */
export interface IPasswordHashStrategy {
	hash(password: string): Promise<string>;
	verify(password: string, hashedPassword: string): Promise<boolean>;
	getAlgorithmIdentifier(): string;
	canVerify(hashedPassword: string): boolean;
}

export const PASSWORD_HASH_STRATEGIES = Symbol('PASSWORD_HASH_STRATEGIES');
export const DEFAULT_PASSWORD_HASH_STRATEGY = Symbol('DEFAULT_PASSWORD_HASH_STRATEGY');
