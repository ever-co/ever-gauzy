import { IConfigStore, IMenuStrategy, ITranslationService, IWindowService } from '../interfaces';
import { AuthenticatedMenuStrategy } from '../strategies/authenticated-menu-strategy';
import { UnauthenticatedMenuStrategy } from '../strategies/unauthenticated-menu-strategy';

/**
 * Represents authentication state
 */
export abstract class AuthState {
	abstract isAuthenticated(): boolean;
	abstract getMenuStrategy(
		translationService: ITranslationService,
		windowService: IWindowService,
		configStore: IConfigStore,
		windowPath: any
	): IMenuStrategy;
}

export class AuthenticatedState extends AuthState {
	constructor(private authData: any) {
		super();
	}

	isAuthenticated(): boolean {
		return true;
	}

	getMenuStrategy(
		translationService: ITranslationService,
		windowService: IWindowService,
		configStore: IConfigStore,
		windowPath: any
	): IMenuStrategy {
		return new AuthenticatedMenuStrategy(translationService, windowService, configStore, windowPath);
	}

	getAuthData(): any {
		return this.authData;
	}
}

export class UnauthenticatedState extends AuthState {
	isAuthenticated(): boolean {
		return false;
	}

	getMenuStrategy(
		translationService: ITranslationService,
		windowService: IWindowService,
		configStore: IConfigStore,
		windowPath: any
	): IMenuStrategy {
		return new UnauthenticatedMenuStrategy(translationService, windowService, configStore, windowPath);
	}
}
