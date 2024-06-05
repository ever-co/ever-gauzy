import { Injectable } from '@angular/core';
import { StoreConfig, Store as AkitaStore, Query } from '@datorama/akita';
import { NgxPermissionsService, NgxRolesService } from 'ngx-permissions';
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
import { GuiDrag } from '../../interfaces';
import { ComponentEnum, SYSTEM_DEFAULT_LAYOUT } from '../../constants';

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
	constructor(protected readonly store: AppStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class PersistQuery extends Query<PersistState> {
	constructor(protected readonly store: PersistStore) {
		super(store);
	}
}

@Injectable({ providedIn: 'root' })
export class Store {
	constructor(
		protected readonly appStore: AppStore,
		protected readonly appQuery: AppQuery,
		protected readonly persistStore: PersistStore,
		protected readonly persistQuery: PersistQuery,
		protected readonly permissionsService: NgxPermissionsService,
		protected readonly ngxRolesService: NgxRolesService
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

	get selectedOrganization(): IOrganization {
		const { selectedOrganization } = this.appQuery.getValue();
		return selectedOrganization;
	}

	set selectedEmployee(employee: ISelectedEmployee) {
		this.appStore.update({
			selectedEmployee: employee
		});
	}

	get selectedEmployee(): ISelectedEmployee {
		const { selectedEmployee } = this.appQuery.getValue();
		return selectedEmployee;
	}

	set selectedOrganization(organization: IOrganization) {
		this.appStore.update({
			selectedOrganization: organization
		});
	}

	set selectedProject(project: IOrganizationProject) {
		this.appStore.update({
			selectedProject: project
		});
	}

	set selectedTeam(team: IOrganizationTeam) {
		this.appStore.update({
			selectedTeam: team
		});
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

	get userRolePermissions(): IRolePermission[] {
		const { userRolePermissions } = this.appQuery.getValue();
		return userRolePermissions;
	}

	set userRolePermissions(rolePermissions: IRolePermission[]) {
		this.appStore.update({
			userRolePermissions: rolePermissions
		});
		this.loadPermissions();
	}

	hasPermission(permission: PermissionsEnum) {
		const { userRolePermissions } = this.appQuery.getValue();
		return !!(userRolePermissions || []).find((p) => p.permission === permission && p.enabled);
	}

	/**
	 * The method checks if a user has all the specified permissions.
	 * @param {PermissionsEnum[]} permissions - An array of permissions that are of type PermissionsEnum.
	 * @returns a boolean value.
	 */
	hasAllPermissions(...permissions: PermissionsEnum[]) {
		return permissions.reduce((acc, permission) => {
			return this.hasPermission(permission) && acc;
		}, true);
	}

	/**
	 * Check any permissions exists
	 */
	hasAnyPermission(...permissions: PermissionsEnum[]) {
		const { userRolePermissions } = this.appQuery.getValue();
		return !!(userRolePermissions || []).find(
			(p: IRolePermission) => permissions.includes(p.permission as PermissionsEnum) && p.enabled
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

	loadRoles() {
		const { user } = this.appQuery.getValue();
		this.ngxRolesService.flushRoles();
		this.ngxRolesService.addRole(user.role.name, () => true);
	}

	loadPermissions() {
		let permissions = [];
		// User permissions load here
		const userPermissions = Object.keys(PermissionsEnum)
			.map((key) => PermissionsEnum[key])
			.filter((permission) => this.hasPermission(permission));
		permissions = permissions.concat(userPermissions);
		this.permissionsService.flushPermissions();
		this.permissionsService.loadPermissions(permissions);
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
