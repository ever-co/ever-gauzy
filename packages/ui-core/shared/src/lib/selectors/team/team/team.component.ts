import { Component, OnInit, OnDestroy, Input, forwardRef, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization, IOrganizationTeam, CrudActionEnum, PermissionsEnum, IPagination } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { map, Observable, Subject, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-core/common';
import { NavigationService, OrganizationTeamStore, OrganizationTeamsService, ToastrService } from '@gauzy/ui-core/core';
import { TruncatePipe } from '../../../pipes';
import { ALL_TEAM_SELECTED } from './default-team';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-team-selector',
	templateUrl: './team.component.html',
	styleUrls: ['./team.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TeamSelectorComponent),
			multi: true
		}
	]
})
export class TeamSelectorComponent implements OnInit, OnDestroy {
	teams: IOrganizationTeam[] = [];
	selectedTeam: IOrganizationTeam;
	hasAddTeam$: Observable<boolean>;

	public organization: IOrganization;
	subject$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

	@Input() shortened = false;
	@Input() disabled = false;
	@Input() multiple = false;
	@Input() label = null;

	private _teamId: string | string[];
	get teamId(): string | string[] {
		return this._teamId;
	}
	set teamId(val: string | string[]) {
		this._teamId = val;
		this.onChange(val);
		this.onTouched(val);
	}

	private _employeeId: string;
	public get employeeId() {
		return this._employeeId;
	}
	@Input() public set employeeId(value) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	private _organizationContactId: string;
	public get organizationContactId(): string {
		return this._organizationContactId;
	}
	@Input() public set organizationContactId(value: string) {
		this._organizationContactId = value;
		this.subject$.next(true);
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for skip global change
	 */
	private _skipGlobalChange: boolean = false;
	get skipGlobalChange(): boolean {
		return this._skipGlobalChange;
	}
	@Input() set skipGlobalChange(value: boolean) {
		this._skipGlobalChange = value;
	}

	private _defaultSelected: boolean = true;
	get defaultSelected(): boolean {
		return this._defaultSelected;
	}
	@Input() set defaultSelected(value: boolean) {
		this._defaultSelected = value;
	}

	private _showAllOption: boolean = true;
	get showAllOption(): boolean {
		return this._showAllOption;
	}
	@Input() set showAllOption(value: boolean) {
		this._showAllOption = value;
	}

	@Output()
	onChanged = new EventEmitter<IOrganizationTeam>();

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _organizationTeamsService: OrganizationTeamsService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly _organizationTeamStore: OrganizationTeamStore,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _navigationService: NavigationService
	) {}

	ngOnInit(): void {
		this.hasAddTeam$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_ADD))
		);
		this.subject$
			.pipe(
				switchMap(() => this.getTeams()),
				tap(() => {
					if (this._activatedRoute.snapshot.queryParams.teamId) {
						this.selectTeamById(this._activatedRoute.snapshot.queryParams.teamId);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._activatedRoute.queryParams
			.pipe(
				filter((query) => !!query.teamId),
				tap(({ teamId }) => this.selectTeamById(teamId)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._organizationTeamStore.organizationTeamAction$
			.pipe(
				filter(({ action, team }) => !!action && !!team),
				tap(() => this._organizationTeamStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ team, action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createOrganizationTeam(team);
						break;
					case CrudActionEnum.UPDATED:
						this.updateOrganizationTeam(team);
						break;
					case CrudActionEnum.DELETED:
						this.deleteOrganizationTeam(team);
						break;
					default:
						break;
				}
			});
	}

	/**
	 * Retrieves teams based on the current organization and employee.
	 */
	async getTeams() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		let teamsResponse: IPagination<IOrganizationTeam>;

		if (this.employeeId) {
			// Fetch teams based on the current employee
			teamsResponse = await this._organizationTeamsService.getMyTeams({
				organizationId,
				tenantId,
				members: { employeeId: this.employeeId }
			});
		} else {
			// Fetch all teams for the organization
			teamsResponse = await this._organizationTeamsService.getAll([], {
				organizationId,
				tenantId,
				...(this.organizationContactId && { organizationContactId: this.organizationContactId })
			});
		}

		// Update teams list
		this.teams = teamsResponse.items || [];

		//Insert All Employees Option
		if (this.showAllOption) {
			this.teams.unshift(ALL_TEAM_SELECTED);
			this.selectTeam(ALL_TEAM_SELECTED);
		}
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._teamId = value instanceof Array ? value : [value];
		} else {
			this._teamId = value;
		}
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Creates a new team with the given name.
	 * @param {string} name - The name of the new team.
	 */
	createNew = async (name: string) => {
		// Check if organization is defined
		if (!this.organization) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;

			// Construct request object with common parameters
			const request = {
				name,
				organizationId,
				tenantId,
				...(this.organizationContactId && { organizationContactId: this.organizationContactId })
			};

			// Include member if employeeId or store user's employeeId is provided
			const employeeId = this.store.user.employee?.id;

			if (this.employeeId || employeeId) {
				const member: Record<string, string> = {
					id: this.employeeId || employeeId
				};
				request['members'] = [member];
			}

			// Create the team
			const team = await this._organizationTeamsService.create(request);

			// Call method to handle the created team
			this.createOrganizationTeam(team);

			// Update teamId
			this.teamId = team.id;

			// Show success message
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM', { name });
		} catch (error) {
			// Show error message
			this.toastrService.error(error);
		}
	};

	/*
	 * After created new organization team pushed on dropdown
	 */
	createOrganizationTeam(team: IOrganizationTeam) {
		const teams: IOrganizationTeam[] = this.teams || [];
		if (Array.isArray(teams)) {
			teams.push(team);
		}
		this.teams = [...teams].filter(isNotEmpty);
	}

	/*
	 * After updated existing organization team changed in the dropdown
	 */
	updateOrganizationTeam(team: IOrganizationTeam) {
		let teams: IOrganizationTeam[] = this.teams || [];
		if (Array.isArray(teams) && teams.length) {
			teams = teams.map((item: IOrganizationTeam) => {
				if (item.id === team.id) {
					return Object.assign({}, item, team);
				}
				return item;
			});
		}
		this.teams = [...teams].filter(isNotEmpty);
	}

	/*
	 * After deleted organization team removed on dropdown
	 */
	deleteOrganizationTeam(team: IOrganizationTeam) {
		let teams: IOrganizationTeam[] = this.teams || [];
		if (Array.isArray(teams) && teams.length) {
			teams = teams.filter((item: IOrganizationTeam) => item.id !== team.id);
		}
		this.teams = [...teams].filter(isNotEmpty);
	}

	selectTeam(team: IOrganizationTeam): void {
		if (!this.skipGlobalChange) {
			this.store.selectedTeam = team || ALL_TEAM_SELECTED;
			this.setAttributesToParams({ teamId: team?.id });
		}
		this.selectedTeam = team || ALL_TEAM_SELECTED;
		this.teamId = this.selectedTeam.id;
		this.onChanged.emit(team);
	}

	/**
	 * Sets attributes to the current navigation parameters.
	 * @param params An object containing key-value pairs representing the parameters to set.
	 */
	private async setAttributesToParams(params: { [key: string]: string | string[] | boolean }) {
		await this._navigationService.updateQueryParams(params);
	}

	selectTeamById(teamId: string) {
		const team = this.teams.find((team: IOrganizationTeam) => teamId === team.id);
		if (team) {
			this.selectTeam(team);
		}
	}

	/**
	 * Display clearable option in team selector
	 *
	 * @returns
	 */
	isClearable(): boolean {
		if (this.selectedTeam === ALL_TEAM_SELECTED) {
			return false;
		}
		return true;
	}

	/**
	 * GET Shortened Name
	 *
	 * @param name
	 * @returns
	 */
	getShortenedName(name: string, limit = 20) {
		if (isEmpty(name)) {
			return;
		}
		const chunks = name.split(/\s+/);
		const [firstName, lastName] = [chunks.shift(), chunks.join(' ')];

		if (firstName && lastName) {
			return (
				this._truncatePipe.transform(firstName, limit / 2, false, '') +
				' ' +
				this._truncatePipe.transform(lastName, limit / 2, false, '.')
			);
		} else {
			return (
				this._truncatePipe.transform(firstName, limit) ||
				this._truncatePipe.transform(lastName, limit) ||
				'[error: bad name]'
			);
		}
	}

	/**
	 * Clear Selector Value
	 *
	 */
	clearSelection() {
		if (!this.showAllOption) {
			this.teamId = null;
		}
	}

	ngOnDestroy(): void {}
}
