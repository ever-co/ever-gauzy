import { Injectable } from '@angular/core';
import { Store as AkitaStore, Query, StoreConfig } from '@datorama/akita';
import {
	ComponentLayoutStyleEnum,
	DefaultValueDateTypeEnum,
	FeatureEnum,
	IFeatureOrganization,
	IFeatureToggle,
	ILanguage,
	IOrganization,
	IOrganizationProject,
	IProposalViewModel,
	IRolePermission,
	ITaskStatus,
	IUser,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChanged, merge, Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { ComponentEnum, SYSTEM_DEFAULT_LAYOUT } from '../constants/layout.constants';

export interface AppState {
	user: IUser | null;
	userRolePermissions: IRolePermission[];
	selectedOrganization: IOrganization | null;
	selectedProposal: IProposalViewModel | null;
	selectedProject: IOrganizationProject | null;
	selectedDate: Date;
	systemLanguages: ILanguage[];
	featureToggles: IFeatureToggle[];
	featureOrganizations: IFeatureOrganization[];
	featureTenant: IFeatureOrganization[];
	isOffline: boolean;
	statuses: ITaskStatus[];
}

export interface PersistState {
	organizationId: string | null;
	clientId: string | null;
	tenantId: string | null;
	token: string | null;
	refreshToken: string | null;
	tokenExpiresAt: number | null;
	userId: string | null;
	serverConnection: number;
	preferredLanguage: LanguagesEnum | null;
	preferredComponentLayout: ComponentLayoutStyleEnum | null;
	componentLayout: Array<[ComponentEnum, ComponentLayoutStyleEnum]>;
	host: string | null;
}

export function createInitialAppState(): AppState {
	return {
		user: null,
		selectedOrganization: null,
		selectedProposal: null,
		selectedProject: null,
		selectedDate: new Date(),
		userRolePermissions: [],
		systemLanguages: [],
		featureToggles: [],
		featureOrganizations: [],
		featureTenant: [],
		isOffline: false,
		statuses: []
	};
}

export function createInitialPersistState(): PersistState {
	return {
		token: null,
		refreshToken: null,
		tokenExpiresAt: null,
		userId: null,
		organizationId: null,
		clientId: null,
		serverConnection: 0,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: null,
		componentLayout: [],
		tenantId: null,
		host: null
	};
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'app' })
export class AppStore extends AkitaStore<AppState> {
	constructor() {
		super(createInitialAppState());
	}
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'persist' })
export class PersistStore extends AkitaStore<PersistState> {
	constructor() {
		super(createInitialPersistState());
	}
}

@Injectable({ providedIn: 'root' })
export class AppQuery extends Query<AppState> {
	constructor(protected store: AppStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class PersistQuery extends Query<PersistState> {
	constructor(protected store: PersistStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class Store {
	// Observable streams
	readonly user$ = this.appQuery.select((state) => state.user);
	readonly selectedOrganization$ = this.appQuery.select((state) => state.selectedOrganization);
	readonly selectedProject$ = this.appQuery.select((state) => state.selectedProject);
	readonly selectedDate$ = this.appQuery.select((state) => state.selectedDate);
	readonly userRolePermissions$ = this.appQuery.select((state) => state.userRolePermissions);
	readonly featureToggles$ = this.appQuery.select((state) => state.featureToggles);
	readonly featureOrganizations$ = this.appQuery.select((state) => state.featureOrganizations);
	readonly featureTenant$ = this.appQuery.select((state) => state.featureTenant);
	readonly statuses$: Observable<ITaskStatus[]> = this.appQuery.select((state) => state.statuses);
	readonly preferredLanguage$ = this.persistQuery.select((state) => state.preferredLanguage);
	readonly preferredComponentLayout$ = this.persistQuery.select((state) => state.preferredComponentLayout);
	readonly componentLayoutMap$ = this.persistQuery
		.select((state) => state.componentLayout)
		.pipe(map((componentLayout) => new Map(componentLayout)));
	readonly systemLanguages$ = this.appQuery.select((state) => state.systemLanguages);
	readonly isOffline$ = this.appQuery.select((state) => state.isOffline);

	constructor(
		private readonly appStore: AppStore,
		private readonly appQuery: AppQuery,
		private readonly persistStore: PersistStore,
		private readonly persistQuery: PersistQuery
	) {}

	/**
	 * Observe any change to the component layout.
	 * Returns the layout for the component given in the params in the following order of preference:
	 * 1. If overridden at component level, return that.
	 * 2. If preferred layout set, then return that.
	 * 3. Return the system default layout.
	 */
	componentLayout$(component: ComponentEnum): Observable<ComponentLayoutStyleEnum> {
		return merge(
			this.persistQuery
				.select((state) => state.preferredComponentLayout)
				.pipe(
					map((preferredLayout) => {
						const dataLayout = this.getLayoutForComponent(component);
						return dataLayout || preferredLayout || SYSTEM_DEFAULT_LAYOUT;
					})
				),
			this.persistQuery
				.select((state) => state.componentLayout)
				.pipe(
					map((componentLayout) => {
						const componentMap = new Map(componentLayout);
						return componentMap.get(component) || this.preferredComponentLayout || SYSTEM_DEFAULT_LAYOUT;
					})
				)
		);
	}

	readonly isAuthenticated$ = this.persistQuery
		.select((state) => ({
			token: state.token,
			refreshToken: state.refreshToken
		}))
		.pipe(
			map(({ token, refreshToken }) => !!token && !!refreshToken),
			distinctUntilChanged(),
			shareReplay({ bufferSize: 1, refCount: true })
		);

	// Getters and Setters
	get selectedOrganization(): IOrganization | null {
		return this.appQuery.getValue().selectedOrganization;
	}

	set selectedOrganization(organization: IOrganization | null) {
		this.appStore.update({ selectedOrganization: organization });
	}

	get selectedProject(): IOrganizationProject | null {
		return this.appQuery.getValue().selectedProject;
	}

	set selectedProject(project: IOrganizationProject | null) {
		this.appStore.update({ selectedProject: project });
	}

	get systemLanguages(): ILanguage[] {
		return this.appQuery.getValue().systemLanguages;
	}

	set systemLanguages(languages: ILanguage[]) {
		this.appStore.update({ systemLanguages: languages });
	}

	get token(): string | null {
		return this.persistQuery.getValue().token;
	}

	set token(token: string | null) {
		this.persistStore.update({ token });
	}

	get refreshToken(): string | null {
		return this.persistQuery.getValue().refreshToken;
	}

	set refreshToken(refreshToken: string | null) {
		this.persistStore.update({ refreshToken });
	}

	get tokenExpiresAt(): number | null {
		return this.persistQuery.getValue().tokenExpiresAt;
	}

	set tokenExpiresAt(expiresAt: number | null) {
		this.persistStore.update({ tokenExpiresAt: expiresAt });
	}

	get userId(): string | null {
		return this.persistQuery.getValue().userId;
	}

	set userId(id: string | null) {
		this.persistStore.update({ userId: id });
	}

	get organizationId(): string | null {
		return this.persistQuery.getValue().organizationId;
	}

	set organizationId(id: string | null) {
		this.persistStore.update({ organizationId: id });
	}

	get user(): IUser | null {
		return this.appQuery.getValue().user;
	}

	set user(user: IUser | null) {
		this.appStore.update({ user });
	}

	get selectedDate(): Date {
		const { selectedDate } = this.appQuery.getValue();
		if (selectedDate instanceof Date) {
			return selectedDate;
		}

		const date = new Date(selectedDate);
		this.appStore.update({ selectedDate: date });
		return date;
	}

	set selectedDate(date: Date) {
		this.appStore.update({ selectedDate: date });
	}

	get selectedProposal(): IProposalViewModel | null {
		return this.appQuery.getValue().selectedProposal;
	}

	set selectedProposal(proposal: IProposalViewModel | null) {
		this.appStore.update({ selectedProposal: proposal });
	}

	get featureToggles(): IFeatureToggle[] {
		return this.appQuery.getValue().featureToggles;
	}

	set featureToggles(featureToggles: IFeatureToggle[]) {
		this.appStore.update({ featureToggles });
	}

	get featureTenant(): IFeatureOrganization[] {
		return this.appQuery.getValue().featureTenant;
	}

	set featureTenant(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({ featureTenant: featureOrganizations });
	}

	get statuses(): ITaskStatus[] {
		return this.appQuery.getValue().statuses;
	}

	set statuses(statuses: ITaskStatus[]) {
		this.appStore.update({ statuses });
	}

	get featureOrganizations(): IFeatureOrganization[] {
		return this.appQuery.getValue().featureOrganizations;
	}

	set featureOrganizations(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({ featureOrganizations });
	}

	get userRolePermissions(): IRolePermission[] {
		return this.appQuery.getValue().userRolePermissions;
	}

	set userRolePermissions(rolePermissions: IRolePermission[]) {
		this.appStore.update({ userRolePermissions: rolePermissions });
	}

	get isOffline(): boolean {
		return this.appQuery.getValue().isOffline;
	}

	set isOffline(value: boolean) {
		this.appStore.update({ isOffline: value });
	}

	get serverConnection(): number {
		return this.persistQuery.getValue().serverConnection;
	}

	set serverConnection(val: number) {
		this.persistStore.update({ serverConnection: val });
	}

	get preferredLanguage(): LanguagesEnum | null {
		return this.persistQuery.getValue().preferredLanguage;
	}

	set preferredLanguage(preferredLanguage: LanguagesEnum | null) {
		this.persistStore.update({ preferredLanguage });
	}

	get preferredComponentLayout(): ComponentLayoutStyleEnum | null {
		return this.persistQuery.getValue().preferredComponentLayout;
	}

	set preferredComponentLayout(preferredComponentLayout: ComponentLayoutStyleEnum | null) {
		this.persistStore.update({ preferredComponentLayout });
	}

	get componentLayout(): Array<[ComponentEnum, ComponentLayoutStyleEnum]> {
		return this.persistQuery.getValue().componentLayout;
	}

	set componentLayout(componentLayout: Array<[ComponentEnum, ComponentLayoutStyleEnum]>) {
		this.persistStore.update({ componentLayout });
	}

	get tenantId(): string | null {
		return this.persistQuery.getValue().tenantId;
	}

	set tenantId(value: string | null) {
		this.persistStore.update({ tenantId: value });
	}

	get host(): string | null {
		return this.persistQuery.getValue().host;
	}

	set host(value: string | null) {
		this.persistStore.update({ host: value });
	}

	/**
	 * Checks if the token is expired or close to expiring (within 5 minutes).
	 * Returns true if token should be refreshed.
	 */
	isTokenExpired(): boolean {
		const expiresAt = this.tokenExpiresAt;
		if (!expiresAt) {
			// If no expiry is set, we cannot determine expiration
			// Return false to avoid unnecessary refresh attempts
			// The server will return 401 if token is actually expired
			console.warn('[Store] Token expiry not set, assuming token is valid');
			return !this.token;
		}
		const now = Date.now();
		const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
		return now >= expiresAt - bufferTime;
	}

	/**
	 * Check if features are enabled/disabled for tenant organization.
	 */
	hasFeatureEnabled(feature: FeatureEnum): boolean {
		const { featureTenant = [], featureOrganizations = [], featureToggles = [] } = this.appQuery.getValue();

		// Check unleash toggle first
		const unleashToggle = featureToggles.find((toggle) => toggle.name === feature && toggle.enabled === false);
		if (unleashToggle) {
			return unleashToggle.enabled;
		}

		// Combine and deduplicate feature organizations
		const uniqueFeatures = new Map<string, IFeatureOrganization>();
		[...featureOrganizations, ...featureTenant].forEach((item) => {
			if (!uniqueFeatures.has(item.featureId)) {
				uniqueFeatures.set(item.featureId, item);
			}
		});

		// Check if feature is enabled
		return Array.from(uniqueFeatures.values()).some((item) => item.feature.code === feature && item.isEnabled);
	}

	/**
	 * Check if user has a specific permission.
	 */
	hasPermission(permission: PermissionsEnum): boolean {
		const { userRolePermissions } = this.appQuery.getValue();
		return userRolePermissions.some((p) => p.permission === permission && p.enabled);
	}

	/**
	 * Check if user has any of the specified permissions.
	 */
	hasPermissions(...permissions: PermissionsEnum[]): boolean {
		const { userRolePermissions } = this.appQuery.getValue();

		if (!userRolePermissions || userRolePermissions.length === 0) {
			return false;
		}

		return userRolePermissions.some((p) => p.enabled && permissions.includes(p.permission as PermissionsEnum));
	}

	/**
	 * Get date based on organization settings.
	 */
	getDateFromOrganizationSettings(): Date {
		const dateObj = this.selectedDate;
		const defaultValueDateType = this.selectedOrganization?.defaultValueDateType;

		switch (defaultValueDateType) {
			case DefaultValueDateTypeEnum.TODAY:
				return new Date();
			case DefaultValueDateTypeEnum.END_OF_MONTH:
				return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
			case DefaultValueDateTypeEnum.START_OF_MONTH:
				return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
			default:
				return new Date();
		}
	}

	/**
	 * Get layout for a specific component.
	 */
	getLayoutForComponent(componentName: ComponentEnum): ComponentLayoutStyleEnum | null {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		return componentLayoutMap.get(componentName) || null;
	}

	/**
	 * Set layout for a specific component.
	 */
	setLayoutForComponent(componentName: ComponentEnum, style: ComponentLayoutStyleEnum): void {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		componentLayoutMap.set(componentName, style);
		const componentLayoutArray = Array.from(componentLayoutMap.entries());
		this.persistStore.update({ componentLayout: componentLayoutArray });
	}

	/**
	 * Clear all state and reset to initial values.
	 */
	clear(): void {
		this.appStore.reset();
		this.persistStore.reset();
	}
}
