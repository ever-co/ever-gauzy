import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	Output,
	EventEmitter
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IOrganization,
	IOrganizationTeam,
	CrudActionEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { map, Observable, Subject, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	distinctUntilChange,
	isEmpty,
	isNotEmpty
} from '@gauzy/common-angular';
import { ALL_TEAM_SELECTED } from './default-team';
import {
	OrganizationTeamsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { TruncatePipe } from '../../pipes';
import { OrganizationTeamStore } from '../../../@core/services/organization-team-store.service';

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
export class TeamSelectorComponent
	implements OnInit, OnDestroy {
	teams: IOrganizationTeam[] = [];
	selectedTeam: IOrganizationTeam;
	hasAddTeam$: Observable<boolean>;

	public organization: IOrganization;
	subject$: Subject<any> = new Subject();
	onChange: any = () => { };
	onTouched: any = () => { };

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
		private readonly organizationTeams: OrganizationTeamsService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly _organizationTeamStore: OrganizationTeamStore,
		private readonly _truncatePipe: TruncatePipe,
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute
	) { }

	ngOnInit(): void {
		this.hasAddTeam$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasAnyPermission(
					PermissionsEnum.ALL_ORG_EDIT,
					PermissionsEnum.ORG_TEAM_ADD
				)
			)
		);
		this.subject$
			.pipe(
				switchMap(() => this.getTeams()),
				tap(() => {
					if (this.activatedRoute.snapshot.queryParams.teamId) {
						this.selectTeamById(this.activatedRoute.snapshot.queryParams.teamId);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.activatedRoute.queryParams
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
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
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

	async getTeams() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (this.employeeId) {
			this.teams = await this.organizationTeams.getAllByEmployee(
				this.employeeId,
				{
					organizationId,
					tenantId,
					...(this.organizationContactId
						? {
							organizationContactId:
								this.organizationContactId
						}
						: {})
				}
			);
		} else {
			const { items = [] } = await this.organizationTeams.getAll([], {
				organizationId,
				tenantId,
				...(this.organizationContactId
					? {
						organizationContactId: this.organizationContactId
					}
					: {})
			});
			this.teams = items;
		}

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

	createNew = async (name: string) => {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const request = {
				name,
				organizationId,
				tenantId,
				...(this.organizationContactId
					? {
						organizationContactId: this.organizationContactId
					}
					: {})
			};
			if (this.employeeId || this.store.user.employeeId) {
				const member: any = {
					id: this.employeeId || this.store.user.employeeId
				};
				request['members'] = [member];
			}

			const team = await this.organizationTeams.create(request);

			this.teams = this.teams.concat([team]);
			this.teamId = team.id;

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM',
				{
					name
				}
			);
		} catch (error) {
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
			teams = teams.filter(
				(item: IOrganizationTeam) => item.id !== team.id
			);
		}
		this.teams = [...teams].filter(isNotEmpty);
	}

	selectTeam(team: IOrganizationTeam): void {
		if (!this.skipGlobalChange) {
			this.store.selectedTeam = team || ALL_TEAM_SELECTED;
			this.setAttributesToParams({ teamId: team?.id || null })
		}
		this.selectedTeam = team || ALL_TEAM_SELECTED;
		this.teamId = this.selectedTeam.id;
		this.onChanged.emit(team);
	}

	private setAttributesToParams(params: Object) {
		this.router.navigate([], {
			relativeTo: this.activatedRoute,
			queryParams: { ...params },
			queryParamsHandling: 'merge',
		});
	}

	selectTeamById(teamId: string) {
		const team = this.teams.find(
			(team: IOrganizationTeam) => teamId === team.id
		);
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

	ngOnDestroy(): void { }
}
