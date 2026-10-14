import { Injector } from '@angular/core';
import { BaseEntityEnum, IOrganizationTeam, IOrganizationTeamEmployee, RolesEnum } from '@gauzy/contracts';
import { OrganizationTeamsService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations a team's View reads — the same the teams page loads. */
export const TEAM_VIEW_RELATIONS = ['members.role', 'members.employee.user', 'tags', 'projects'];

const isManager = (member: IOrganizationTeamEmployee) => member?.role?.name === RolesEnum.MANAGER;

/** A team, described for `ngx-record-view`: managers, members, projects, tags. */
export function buildTeamViewSections(team: IOrganizationTeam): IRecordViewSection[] {
	const members = team.members ?? [];
	return [
		{
			fields: [
				{ label: 'ORGANIZATIONS_PAGE.NAME', key: 'name' },
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS',
					type: 'people',
					value: members.filter(isManager).map((member) => member.employee),
					wide: true
				},
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS',
					type: 'people',
					value: members.filter((member) => !isManager(member)).map((member) => member.employee),
					wide: true
				},
				{ label: 'SM_TABLE.PROJECTS', value: (team.projects ?? []).map((project) => project.name).join(', ') }
			]
		},
		{ fields: [{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }] }
	];
}

/** `/pages/organization/teams/view/:id` — one team, full width (what a team favorite opens). */
export const TEAM_RECORD_VIEW: IRecordViewRouteData<IOrganizationTeam> = {
	heading: 'ORGANIZATIONS_PAGE.TEAMS',
	backLink: '/pages/organization/teams',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector
			.get(OrganizationTeamsService)
			.getAll(TEAM_VIEW_RELATIONS, { id, organizationId: scope.organizationId, tenantId: scope.tenantId } as any);
		return items?.[0] ?? null;
	},
	sections: (team) => buildTeamViewSections(team),
	subtitle: (team) => team.name,
	favorite: { entity: BaseEntityEnum.OrganizationTeam, name: (team) => team.name }
};
