import {
	DefaultValueDateTypeEnum,
	Organization,
	PermissionsEnum,
	RolePermissions,
	User,
	Tag
} from '@gauzy/models';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { ProposalViewModel } from '../../pages/proposals/proposals.component';
import { Injectable } from '@angular/core';
import {
	resetStores,
	StoreConfig,
	Store as AkitaStore,
	Query
} from '@datorama/akita';

export interface AppState {
	user: User;
	userRolePermissions: RolePermissions[];
	selectedOrganization: Organization;
	selectedEmployee: SelectedEmployee;
	selectedProposal: ProposalViewModel;
	selectedDate: Date;
	selectedTags: Tag[];
}

export interface PersistState {
	token: string;
	userId: string;
	serverConnection: string;
}

export function createInitialAppState(): AppState {
	return {
		selectedDate: new Date(),
		selectedTags: [],
		userRolePermissions: []
	} as AppState;
}

export function createInitialPersistState(): PersistState {
	const token = localStorage.getItem('token') || null;
	const userId = localStorage.getItem('_userId') || null;
	const serverConnection = localStorage.getItem('serverConnection') || null;

	return {
		token,
		userId,
		serverConnection
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
	selectedTags$ = this.appQuery.select((state) => state.selectedTags);
	selectedOrganization$ = this.appQuery.select(
		(state) => state.selectedOrganization
	);
	selectedEmployee$ = this.appQuery.select((state) => state.selectedEmployee);
	selectedDate$ = this.appQuery.select((state) => state.selectedDate);
	userRolePermissions$ = this.appQuery.select(
		(state) => state.userRolePermissions
	);

	get selectedOrganization(): Organization {
		const { selectedOrganization } = this.appQuery.getValue();
		return selectedOrganization;
	}

	get selectedTags(): Tag[] {
		const { selectedTags } = this.appQuery.getValue();
		return selectedTags;
	}

	set selectedEmployee(employee: SelectedEmployee) {
		this.appStore.update({
			selectedEmployee: employee
		});
	}

	get selectedEmployee(): SelectedEmployee {
		const { selectedEmployee } = this.appQuery.getValue();
		return selectedEmployee;
	}

	set selectedOrganization(organization: Organization) {
		this.appStore.update({
			selectedOrganization: organization
		});
	}

	set selectedTags(tags: Tag[]) {
		this.appStore.update({
			selectedTags: tags
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

	get userId(): User['id'] | null {
		const { userId } = this.persistQuery.getValue();
		return userId;
	}

	set userId(id: User['id'] | null) {
		this.persistStore.update({
			userId: id
		});
	}

	get user(): User {
		const { user } = this.appQuery.getValue();
		return user;
	}

	set user(user: User) {
		this.appStore.update({
			user: user
		});
	}

	get selectedDate() {
		const { selectedDate } = this.appQuery.getValue();
		if (selectedDate instanceof Date) {
			return selectedDate;
		}

		const date = new Date(selectedDate);
		this.appStore.update({
			selectedDate: date
		});

		return date;
	}

	set selectedDate(date: Date) {
		this.appStore.update({
			selectedDate: date
		});
	}

	get selectedProposal(): ProposalViewModel {
		const { selectedProposal } = this.appQuery.getValue();
		return selectedProposal;
	}

	set selectedProposal(proposal: ProposalViewModel) {
		this.appStore.update({
			selectedProposal: proposal
		});
	}

	get userRolePermissions(): RolePermissions[] {
		const { userRolePermissions } = this.appQuery.getValue();
		return userRolePermissions;
	}

	set userRolePermissions(rolePermissions: RolePermissions[]) {
		this.appStore.update({
			userRolePermissions: rolePermissions
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

		switch (this.selectedOrganization.defaultValueDateType) {
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

	set serverConnection(val: string) {
		this.persistStore.update({
			serverConnection: val
		});
	}

	clear() {
		resetStores();
	}
}
