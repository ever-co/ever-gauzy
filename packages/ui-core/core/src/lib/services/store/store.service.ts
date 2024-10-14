import { Injectable } from '@angular/core';
import { StoreConfig, Store as AkitaStore, Query } from '@datorama/akita';
import { merge, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { uniq } from 'underscore';
import {
	IOrganization,
	PermissionsEnum,
	IRolePermission,
	IUser,
	LanguagesEnum,
	IOrganizationProject,
	ILanguage,
	IProposalViewModel,
	IFeatureToggle,
	IFeatureOrganization,
	FeatureEnum,
	ISelectedEmployee,
	ComponentLayoutStyleEnum,
	IOrganizationTeam
} from '@gauzy/contracts';
import { ComponentEnum, GuiDrag, SYSTEM_DEFAULT_LAYOUT } from '@gauzy/ui-core/common';

export interface AppState {
	user: IUser;
	userRolePermissions: IRolePermission[];
	selectedOrganization: IOrganization;
	selectedEmployee: ISelectedEmployee;
	selectedProposal: IProposalViewModel;
	selectedProject: IOrganizationProject;
	selectedTeam: IOrganizationTeam;
	systemLanguages: ILanguage[];
	featureToggles: IFeatureToggle[];
	featureOrganizations: IFeatureOrganization[];
	featureTenant: IFeatureOrganization[];
}

export interface PersistState {
	organizationId?: string;
	clientId?: string;
	token: string;
	refresh_token: string;
	userId: string;
	serverConnection: number;
	preferredLanguage: LanguagesEnum;
	preferredComponentLayout: ComponentLayoutStyleEnum;
	componentLayout: any[]; //This would be a Map but since Maps can't be serialized/deserialized it is stored as an array
	themeName: string;
	windows: Partial<GuiDrag>[];
	widgets: Partial<GuiDrag>[];
	tenantId: string;
}

export function createInitialAppState(): AppState {
	return {
		userRolePermissions: [],
		featureToggles: [],
		featureOrganizations: [],
		featureTenant: []
	} as AppState;
}

export function createInitialPersistState(): PersistState {
	const token = localStorage.getItem('token') || null;
	const refresh_token = localStorage.getItem('refresh_token') || null;
	const userId = localStorage.getItem('_userId') || null;
	const organizationId = localStorage.getItem('_organizationId') || null;
	const serverConnection = parseInt(localStorage.getItem('serverConnection')) || null;
	const preferredLanguage = localStorage.getItem('preferredLanguage') || null;
	const componentLayout = localStorage.getItem('componentLayout') || [];
	const themeName = localStorage.getItem('themeName') || null;
	const widgets = JSON.parse(localStorage.getItem('_widgets'));
	const windows = JSON.parse(localStorage.getItem('_windows'));
	const tenantId = localStorage.getItem('_tenantId') || null;

	return {
		token,
		refresh_token,
		userId,
		organizationId,
		serverConnection,
		preferredLanguage,
		componentLayout,
		themeName,
		widgets,
		windows,
		tenantId
	} as PersistState;
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
	constructor(store: AppStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class PersistQuery extends Query<PersistState> {
	constructor(store: PersistStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class Store {
	constructor(
		protected readonly appStore: AppStore,
		protected readonly appQuery: AppQuery,
		protected readonly persistStore: PersistStore,
		protected readonly persistQuery: PersistQuery
	) {}

	user$ = this.appQuery.select((state) => state.user);
	selectedOrganization$ = this.appQuery.select((state) => state.selectedOrganization);
	selectedEmployee$ = this.appQuery.select((state) => state.selectedEmployee);
	selectedProject$ = this.appQuery.select((state) => state.selectedProject);
	selectedTeam$ = this.appQuery.select((state) => state.selectedTeam);
	userRolePermissions$ = this.appQuery.select((state) => state.userRolePermissions);
	featureToggles$ = this.appQuery.select((state) => state.featureToggles);
	featureOrganizations$ = this.appQuery.select((state) => state.featureOrganizations);
	featureTenant$ = this.appQuery.select((state) => state.featureTenant);
	preferredLanguage$ = this.persistQuery.select((state) => state.preferredLanguage);
	preferredComponentLayout$ = this.persistQuery.select((state) => state.preferredComponentLayout);
	componentLayoutMap$ = this.persistQuery
		.select((state) => state.componentLayout)
		.pipe(map((componentLayout) => new Map(componentLayout)));
	systemLanguages$ = this.appQuery.select((state) => state.systemLanguages);

	subject = new Subject<ComponentEnum>();

	/**
	 * Observe any change to the component layout.
	 * Returns the layout for the component given in the params in the following order of preference
	 * 1. If overridden at component level, return that.
	 * Else
	 * 2. If preferred layout set, then return that
	 * Else
	 * 3. Return the system default layout
	 */
	componentLayout$(component: ComponentEnum) {
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

	// Getter and Setter for selectedOrganization
	get selectedOrganization(): IOrganization {
		/**
		 * Retrieves the currently selected organization from the application's state.
		 *
		 * @returns {IOrganization} - The selected organization object.
		 */
		return this.appQuery.getValue().selectedOrganization;
	}

	set selectedOrganization(organization: IOrganization) {
		/**
		 * Updates the selected organization in the application's state.
		 *
		 * @param {IOrganization} organization - The organization object to be set as the selected organization.
		 */
		this.appStore.update({ selectedOrganization: organization });
	}

	// Getter and Setter for selectedEmployee
	get selectedEmployee(): ISelectedEmployee {
		/**
		 * Retrieves the currently selected employee from the application's state.
		 *
		 * @returns {ISelectedEmployee} - The selected employee object.
		 */
		return this.appQuery.getValue().selectedEmployee;
	}

	set selectedEmployee(employee: ISelectedEmployee) {
		/**
		 * Updates the selected employee in the application's state.
		 *
		 * @param {ISelectedEmployee} employee - The employee object to be set as the selected employee.
		 */
		this.appStore.update({ selectedEmployee: employee });
	}

	// Getter and Setter for selectedProject
	get selectedProject(): IOrganizationProject {
		/**
		 * Retrieves the currently selected project from the application's state.
		 *
		 * @returns {IOrganizationProject} - The selected project object.
		 */
		return this.appQuery.getValue().selectedProject;
	}

	set selectedProject(project: IOrganizationProject) {
		/**
		 * Updates the selected project in the application's state.
		 *
		 * @param {IOrganizationProject} project - The project object to be set as the selected project.
		 */
		this.appStore.update({ selectedProject: project });
	}

	// Getter and Setter for selectedTeam
	get selectedTeam(): IOrganizationTeam {
		/**
		 * Retrieves the currently selected team from the application's state.
		 *
		 * @returns {IOrganizationTeam} - The selected team object.
		 */
		return this.appQuery.getValue().selectedTeam;
	}

	set selectedTeam(team: IOrganizationTeam) {
		/**
		 * Updates the selected team in the application's state.
		 *
		 * @param {IOrganizationTeam} team - The team object to be set as the selected team.
		 */
		this.appStore.update({ selectedTeam: team });
	}

	set systemLanguages(languages: ILanguage[]) {
		this.appStore.update({
			systemLanguages: languages
		});
	}

	get systemLanguages(): ILanguage[] {
		const { systemLanguages } = this.appQuery.getValue();
		return systemLanguages;
	}

	get refresh_token(): string | null {
		const { refresh_token } = this.persistQuery.getValue();
		return refresh_token;
	}

	set refresh_token(refresh_token: string) {
		this.persistStore.update({
			refresh_token: refresh_token
		});
	}

	get token(): string | null {
		const { token } = this.persistQuery.getValue();
		return token;
	}

	set token(token: string) {
		this.persistStore.update({
			token: token
		});
	}

	get userId(): IUser['id'] | null {
		const { userId } = this.persistQuery.getValue();
		return userId;
	}

	set userId(id: IUser['id'] | null) {
		this.persistStore.update({
			userId: id
		});
	}

	get organizationId(): IOrganization['id'] | null {
		const { organizationId } = this.persistQuery.getValue();
		return organizationId;
	}

	set organizationId(id: IOrganization['id'] | null) {
		this.persistStore.update({
			organizationId: id
		});
	}

	get user(): IUser {
		const { user } = this.appQuery.getValue();
		return user;
	}

	set user(user: IUser) {
		this.appStore.update({
			user: user
		});
	}

	get selectedProposal(): IProposalViewModel {
		const { selectedProposal } = this.appQuery.getValue();
		return selectedProposal;
	}

	set selectedProposal(proposal: IProposalViewModel) {
		this.appStore.update({
			selectedProposal: proposal
		});
	}

	get featureToggles(): IFeatureToggle[] {
		const { featureToggles } = this.appQuery.getValue();
		return featureToggles;
	}

	set featureToggles(featureToggles: IFeatureToggle[]) {
		this.appStore.update({
			featureToggles: featureToggles
		});
	}

	get featureTenant(): IFeatureOrganization[] {
		const { featureTenant } = this.appQuery.getValue();
		return featureTenant;
	}

	set featureTenant(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({
			featureTenant: featureOrganizations
		});
	}

	get featureOrganizations(): IFeatureOrganization[] {
		const { featureOrganizations } = this.appQuery.getValue();
		return featureOrganizations;
	}

	set featureOrganizations(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({
			featureOrganizations: featureOrganizations
		});
	}

	/*
	 * Check features are enabled/disabled for tenant organization
	 */
	hasFeatureEnabled(feature: FeatureEnum) {
		const { featureTenant = [], featureOrganizations = [], featureToggles = [] } = this.appQuery.getValue();
		const filtered = uniq([...featureOrganizations, ...featureTenant], (x) => x.featureId);

		const unleashToggle = featureToggles.find((toggle) => toggle.name === feature && toggle.enabled === false);
		if (unleashToggle) {
			return unleashToggle.enabled;
		}

		return !!filtered.find((item) => item.feature.code === feature && item.isEnabled);
	}

	/**
	 * Returns the user role permissions from the application state.
	 *
	 * @return {IRolePermission[]} The user role permissions.
	 */
	get userRolePermissions(): IRolePermission[] {
		const { userRolePermissions } = this.appQuery.getValue();
		return userRolePermissions;
	}

	/**
	 * Updates the user role permissions in the application state.
	 *
	 * @param {IRolePermission[]} userRolePermissions - The new user role permissions.
	 */
	set userRolePermissions(userRolePermissions: IRolePermission[]) {
		this.appStore.update({ userRolePermissions });
	}

	/**
	 * Checks if the user has a specific permission.
	 *
	 * @param {PermissionsEnum} permission - The permission to check.
	 * @return {boolean} Returns true if the user has the permission, false otherwise.
	 */
	hasPermission(permission: PermissionsEnum): boolean {
		const { userRolePermissions } = this.appQuery.getValue();
		return (userRolePermissions || []).some((p) => p.permission === permission && p.enabled);
	}

	/**
	 * Checks if the user has all the specified permissions.
	 *
	 * @param {...PermissionsEnum[]} permissions - The permissions to check.
	 * @return {boolean} Returns true if the user has all the permissions, false otherwise.
	 */
	hasAllPermissions(...permissions: PermissionsEnum[]): boolean {
		return permissions.every((permission) => this.hasPermission(permission));
	}

	/**
	 * Checks if the user has any of the specified permissions.
	 *
	 * @param {...PermissionsEnum[]} permissions - The permissions to check.
	 * @return {boolean} Returns true if the user has any of the permissions, false otherwise.
	 */
	hasAnyPermission(...permissions: PermissionsEnum[]): boolean {
		// Early return if no permissions are provided
		if (permissions.length === 0) return false;

		const { userRolePermissions } = this.appQuery.getValue();
		const set = new Set(permissions);

		// Check if any user role permission matches the required permissions
		return (userRolePermissions || []).some(
			(p: IRolePermission) => set.has(p.permission as PermissionsEnum) && p.enabled
		);
	}

	get serverConnection() {
		const { serverConnection } = this.persistQuery.getValue();
		return serverConnection;
	}

	set serverConnection(val: number) {
		this.persistStore.update({
			serverConnection: val
		});
	}

	get preferredLanguage(): any | null {
		const { preferredLanguage } = this.persistQuery.getValue();
		return preferredLanguage;
	}

	set preferredLanguage(preferredLanguage) {
		this.persistStore.update({
			preferredLanguage: preferredLanguage
		});
	}

	get preferredComponentLayout(): any | null {
		const { preferredComponentLayout } = this.persistQuery.getValue();
		return preferredComponentLayout;
	}

	set preferredComponentLayout(preferredComponentLayout) {
		this.persistStore.update({
			preferredComponentLayout: preferredComponentLayout
		});
	}

	clear() {
		this.appStore.reset();
		this.persistStore.reset();
	}

	getLayoutForComponent(componentName: ComponentEnum): ComponentLayoutStyleEnum {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		return componentLayoutMap.get(componentName) as ComponentLayoutStyleEnum;
	}

	setLayoutForComponent(componentName: ComponentEnum, style: ComponentLayoutStyleEnum) {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		componentLayoutMap.set(componentName, style);
		const componentLayoutArray = Array.from(componentLayoutMap.entries()) as any;
		this.persistStore.update({
			componentLayout: componentLayoutArray
		});
	}

	set componentLayout(componentLayout: any[]) {
		this.persistStore.update({
			componentLayout
		});
	}

	get currentTheme(): string | null {
		const { themeName } = this.persistQuery.getValue();
		return themeName;
	}

	set currentTheme(name: string) {
		this.persistStore.update({
			themeName: name
		});
	}

	get windows(): Partial<GuiDrag>[] {
		const { windows } = this.persistQuery.getValue();
		return windows as Partial<GuiDrag>[];
	}

	set windows(values: Partial<GuiDrag>[]) {
		this.persistStore.update({
			windows: values
		});
	}

	get widgets(): Partial<GuiDrag>[] {
		const { widgets } = this.persistQuery.getValue();
		return widgets as Partial<GuiDrag>[];
	}

	set widgets(values: Partial<GuiDrag>[]) {
		this.persistStore.update({
			widgets: values
		});
	}

	get tenantId(): string | null {
		const { tenantId } = this.persistQuery.getValue();
		return tenantId;
	}

	set tenantId(value: string) {
		this.persistStore.update({
			tenantId: value
		});
	}
}
