import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-core/core';
import { OrganizationProjectsService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-all-team',
	templateUrl: './all-team.component.html',
	styleUrls: ['./all-team.component.scss']
})
export class AllTeamComponent implements OnInit {
	@Input()
	public teams: any[];
	@Output()
	public selectedTeam: EventEmitter<any> = new EventEmitter();

	constructor(private readonly _store: Store, private readonly _projectService: OrganizationProjectsService) {
		this._projectCount = 0;
		this._organization = null;
	}

	private _projectCount: number;

	get projectCount(): number {
		return this._projectCount;
	}

	set projectCount(value: number) {
		this._projectCount = value;
	}

	private _organization: any;

	public get organization(): any {
		return this._organization;
	}

	@Input()
	public set organization(value: any) {
		this._organization = value;
	}

	ngOnInit(): void {
		(async () => await this.loadProjectsCount())();
	}

	public onSelectTeam(team: any) {
		this.selectedTeam.emit(team);
	}

	private async loadProjectsCount() {
		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		try {
			this.projectCount = await this._projectService.getCount({
				organizationId,
				tenantId
			});
		} catch (e) {}
	}
}
