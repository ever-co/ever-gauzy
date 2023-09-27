import {
	DefaultValueDateTypeEnum,
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
	ComponentLayoutStyleEnum,
	ITaskStatus,
} from '@gauzy/contracts';
import { Injectable } from '@angular/core';
import { StoreConfig, Store as AkitaStore, Query } from '@datorama/akita';
import {
	ComponentEnum,
	SYSTEM_DEFAULT_LAYOUT,
} from '../constants/layout.constants';
import { map } from 'rxjs/operators';
import { merge, Observable, Subject } from 'rxjs';
import * as _ from 'underscore';

export interface AppState {
	user: IUser;
	userRolePermissions: IRolePermission[];
	selectedOrganization: IOrganization;
	selectedProposal: IProposalViewModel;
	selectedProject: IOrganizationProject;
	selectedDate: Date;
	systemLanguages: ILanguage[];
	featureToggles: IFeatureToggle[];
	featureOrganizations: IFeatureOrganization[];
	featureTenant: IFeatureOrganization[];
	isOffline: boolean;
	statuses: ITaskStatus[];
}

export interface PersistState {
	organizationId?: string;
	clientId?: string;
	tenantId: string;
	token: string;
	userId: string;
	serverConnection: number;
	preferredLanguage: LanguagesEnum;
	preferredComponentLayout: ComponentLayoutStyleEnum;
	componentLayout: any[]; //This would be a Map but since Maps can't be serialized/deserialized it is stored as an array
	host: string;
}

export function createInitialAppState(): AppState {
	return {
		selectedDate: new Date(),
		userRolePermissions: [],
		featureToggles: [],
		featureOrganizations: [],
		featureTenant: [],
		isOffline: false,
		statuses: [],
	} as AppState;
}

export function createInitialPersistState(): PersistState {
	const token = localStorage.getItem('token') || null;
	const userId = localStorage.getItem('_userId') || null;
	const organizationId = localStorage.getItem('_organizationId') || null;
	const serverConnection =
		parseInt(localStorage.getItem('serverConnection')) || null;
	const preferredLanguage = localStorage.getItem('preferredLanguage') || null;
	const componentLayout = localStorage.getItem('componentLayout') || [];
	const tenantId = localStorage.getItem('tenantId') || null;
	const host = localStorage.getItem('_host') || null;

	return {
		token,
		userId,
		organizationId,
		serverConnection,
		preferredLanguage,
		componentLayout,
		tenantId,
		host,
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
	constructor(
		protected appStore: AppStore,
		protected appQuery: AppQuery,
		protected persistStore: PersistStore,
		protected persistQuery: PersistQuery
	) {}

	user$ = this.appQuery.select((state) => state.user);
	selectedOrganization$ = this.appQuery.select(
		(state) => state.selectedOrganization
	);
	selectedProject$ = this.appQuery.select((state) => state.selectedProject);
	selectedDate$ = this.appQuery.select((state) => state.selectedDate);
	userRolePermissions$ = this.appQuery.select(
		(state) => state.userRolePermissions
	);
	featureToggles$ = this.appQuery.select((state) => state.featureToggles);

	featureOrganizations$ = this.appQuery.select(
		(state) => state.featureOrganizations
	);

	statuses$: Observable<ITaskStatus[]> = this.appQuery.select(
		(state) => state.statuses
	);

	featureTenant$ = this.appQuery.select((state) => state.featureTenant);
	preferredLanguage$ = this.persistQuery.select(
		(state) => state.preferredLanguage
	);
	preferredComponentLayout$ = this.persistQuery.select(
		(state) => state.preferredComponentLayout
	);
	componentLayoutMap$ = this.persistQuery
		.select((state) => state.componentLayout)
		.pipe(map((componentLayout) => new Map(componentLayout)));
	systemLanguages$ = this.appQuery.select((state) => state.systemLanguages);
	isOffline$ = this.appQuery.select((state) => state.isOffline);

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
						const dataLayout =
							this.getLayoutForComponent(component);
						return (
							dataLayout ||
							preferredLayout ||
							SYSTEM_DEFAULT_LAYOUT
						);
					})
				),
			this.persistQuery
				.select((state) => state.componentLayout)
				.pipe(
					map((componentLayout) => {
						const componentMap = new Map(componentLayout);
						return (
							componentMap.get(component) ||
							this.preferredComponentLayout ||
							SYSTEM_DEFAULT_LAYOUT
						);
					})
				)
		);
	}

	get selectedOrganization(): IOrganization {
		const { selectedOrganization } = this.appQuery.getValue();
		return selectedOrganization;
	}

	set selectedOrganization(organization: IOrganization) {
		this.appStore.update({
			selectedOrganization: organization,
		});
	}

	set selectedProject(project: IOrganizationProject) {
		this.appStore.update({
			selectedProject: project,
		});
	}

	set systemLanguages(languages: ILanguage[]) {
		this.appStore.update({
			systemLanguages: languages,
		});
	}

	get systemLanguages(): ILanguage[] {
		const { systemLanguages } = this.appQuery.getValue();
		return systemLanguages;
	}

	get token(): string | null {
		const { token } = this.persistQuery.getValue();
		return token;
	}

	set token(token: string) {
		this.persistStore.update({
			token: token,
		});
	}

	get userId(): IUser['id'] | null {
		const { userId } = this.persistQuery.getValue();
		return userId;
	}

	set userId(id: IUser['id'] | null) {
		this.persistStore.update({
			userId: id,
		});
	}

	get organizationId(): IOrganization['id'] | null {
		const { organizationId } = this.persistQuery.getValue();
		return organizationId;
	}

	set organizationId(id: IOrganization['id'] | null) {
		this.persistStore.update({
			organizationId: id,
		});
	}

	get user(): IUser {
		const { user } = this.appQuery.getValue();
		return user;
	}

	set user(user: IUser) {
		this.appStore.update({
			user: user,
		});
	}

	get selectedDate() {
		const { selectedDate } = this.appQuery.getValue();
		if (selectedDate instanceof Date) {
			return selectedDate;
		}

		const date = new Date(selectedDate);
		this.appStore.update({
			selectedDate: date,
		});

		return date;
	}

	set selectedDate(date: Date) {
		this.appStore.update({
			selectedDate: date,
		});
	}

	get selectedProposal(): IProposalViewModel {
		const { selectedProposal } = this.appQuery.getValue();
		return selectedProposal;
	}

	set selectedProposal(proposal: IProposalViewModel) {
		this.appStore.update({
			selectedProposal: proposal,
		});
	}

	get featureToggles(): IFeatureToggle[] {
		const { featureToggles } = this.appQuery.getValue();
		return featureToggles;
	}

	set featureToggles(featureToggles: IFeatureToggle[]) {
		this.appStore.update({
			featureToggles: featureToggles,
		});
	}

	get featureTenant(): IFeatureOrganization[] {
		const { featureTenant } = this.appQuery.getValue();
		return featureTenant;
	}

	set featureTenant(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({
			featureTenant: featureOrganizations,
		});
	}

	get statuses(): ITaskStatus[] {
		const { statuses } = this.appQuery.getValue();
		return statuses;
	}

	set statuses(statuses: ITaskStatus[]) {
		this.appStore.update({
			statuses,
		});
	}

	get featureOrganizations(): IFeatureOrganization[] {
		const { featureOrganizations } = this.appQuery.getValue();
		return featureOrganizations;
	}

	set featureOrganizations(featureOrganizations: IFeatureOrganization[]) {
		this.appStore.update({
			featureOrganizations: featureOrganizations,
		});
	}

	/*
	 * Check features are enabled/disabled for tenant organization
	 */
	hasFeatureEnabled(feature: FeatureEnum) {
		const {
			featureTenant = [],
			featureOrganizations = [],
			featureToggles = [],
		} = this.appQuery.getValue();
		const filtered = _.uniq(
			[...featureOrganizations, ...featureTenant],
			(x) => x.featureId
		);

		const unleashToggle = featureToggles.find(
			(toggle) => toggle.name === feature && toggle.enabled === false
		);
		if (unleashToggle) {
			return unleashToggle.enabled;
		}

		return !!filtered.find(
			(item) => item.feature.code === feature && item.isEnabled
		);
	}

	get userRolePermissions(): IRolePermission[] {
		const { userRolePermissions } = this.appQuery.getValue();
		return userRolePermissions;
	}

	set userRolePermissions(rolePermissions: IRolePermission[]) {
		this.appStore.update({
			userRolePermissions: rolePermissions,
		});
		// this.loadPermissions();
	}

	get isOffline(): boolean {
		const { isOffline } = this.appQuery.getValue();
		return isOffline;
	}

	set isOffline(value: boolean) {
		this.appStore.update({
			isOffline: value,
		});
	}

	hasPermission(permission: PermissionsEnum) {
		const { userRolePermissions } = this.appQuery.getValue();
		return !!(userRolePermissions || []).find(
			(p) => p.permission === permission && p.enabled
		);
	}

	getDateFromOrganizationSettings() {
		const dateObj = this.selectedDate;
		switch (
			this.selectedOrganization &&
			this.selectedOrganization.defaultValueDateType
		) {
			case DefaultValueDateTypeEnum.TODAY: {
				return new Date(Date.now());
			}
			case DefaultValueDateTypeEnum.END_OF_MONTH: {
				return new Date(dateObj.getFullYear(), dateObj.getMonth(), 0);
			}
			case DefaultValueDateTypeEnum.START_OF_MONTH: {
				return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
			}
			default: {
				return new Date(Date.now());
			}
		}
	}

	get serverConnection() {
		const { serverConnection } = this.persistQuery.getValue();
		return serverConnection;
	}

	set serverConnection(val: number) {
		this.persistStore.update({
			serverConnection: val,
		});
	}

	get preferredLanguage(): any | null {
		const { preferredLanguage } = this.persistQuery.getValue();
		return preferredLanguage;
	}

	set preferredLanguage(preferredLanguage) {
		this.persistStore.update({
			preferredLanguage: preferredLanguage,
		});
	}

	get preferredComponentLayout(): any | null {
		const { preferredComponentLayout } = this.persistQuery.getValue();
		return preferredComponentLayout;
	}

	set preferredComponentLayout(preferredComponentLayout) {
		this.persistStore.update({
			preferredComponentLayout: preferredComponentLayout,
		});
	}

	clear() {
		this.appStore.reset();
		this.persistStore.reset();
	}

	loadRoles() {
		const { user } = this.appQuery.getValue();
	}

	getLayoutForComponent(
		componentName: ComponentEnum
	): ComponentLayoutStyleEnum {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		return componentLayoutMap.get(
			componentName
		) as ComponentLayoutStyleEnum;
	}

	setLayoutForComponent(
		componentName: ComponentEnum,
		style: ComponentLayoutStyleEnum
	) {
		const { componentLayout } = this.persistQuery.getValue();
		const componentLayoutMap = new Map(componentLayout);
		componentLayoutMap.set(componentName, style);
		const componentLayoutArray = Array.from(
			componentLayoutMap.entries()
		) as any;
		this.persistStore.update({
			componentLayout: componentLayoutArray,
		});
	}

	set componentLayout(componentLayout: any[]) {
		this.persistStore.update({
			componentLayout,
		});
	}

	get tenantId(): string | null {
		const { tenantId } = this.persistQuery.getValue();
		return tenantId;
	}

	set tenantId(value: string) {
		this.persistStore.update({
			tenantId: value,
		});
	}

	get host(): string {
		const { host } = this.persistQuery.getValue();
		return host;
	}

	set host(value: string) {
		this.persistStore.update({
			host: value,
		});
	}
}
