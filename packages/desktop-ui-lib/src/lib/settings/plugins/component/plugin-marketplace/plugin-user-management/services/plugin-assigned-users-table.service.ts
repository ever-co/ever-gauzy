import { Injectable } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { Cell } from 'angular2-smart-table';
import { Observable } from 'rxjs';
import { PluginUserAssignment } from '../../+state/stores/plugin-user-assignment.store';
import { AccessToggleCellComponent, AccessToggleRow } from '../render/access-toggle/access-toggle-cell.component';
import { AssignmentDateCellComponent } from '../render/assignment-date/assignment-date-cell.component';
import { AssignmentStatusCellComponent } from '../render/assignment-status/assignment-status-cell.component';
import { UnassignActionCellComponent, UnassignRowData } from '../render/unassign-action/unassign-action-cell.component';
import { UserCellComponent } from '../render/user-cell/user-cell.component';

/** Operator that limits a subscription lifetime to the host component. */
export type PipeUntilDestroyed = <T>(source: Observable<T>) => Observable<T>;

/** Row data representing a user toggle action from the assigned-users table */
export interface AssignedUserRow extends AccessToggleRow {
	newState: boolean;
}

/** Callbacks wired from the assigned-users table to the host component. */
export interface AssignedUsersTableHandlers {
	onToggle: (rowData: AssignedUserRow) => void;
	onUnassign: (assignment: PluginUserAssignment) => void;
	pipeUntilDestroyed: PipeUntilDestroyed;
}

/**
 * Shared factory for the "Assigned Users" angular2-smart-table settings.
 *
 * DRY Principle: Centralises column definitions and row-mapping so both
 * PluginUserManagementComponent (dialog) and UserManagementTabComponent (tab)
 * stay in sync without duplicating code.
 *
 * Single Responsibility: Only responsible for building table configuration
 * and mapping domain objects to flat table rows.
 */
@Injectable({ providedIn: 'root' })
export class PluginAssignedUsersTableService {
	/**
	 * Build angular2-smart-table column settings for the assigned-users table.
	 * Callers pass their own destroy-scoped pipe so EventEmitter streams
	 * are automatically cleaned up with the host component lifecycle.
	 *
	 * @param handlers - Toggle/unassign callbacks + destroy pipe operator
	 */
	buildSettings({ onToggle, onUnassign, pipeUntilDestroyed }: AssignedUsersTableHandlers): Record<string, unknown> {
		return {
			columns: {
				_user: {
					title: 'User',
					type: 'custom',
					renderComponent: UserCellComponent,
					componentInitFunction: (instance: UserCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				email: { title: 'Email' },
				_assignedAt: {
					title: 'Assigned On',
					type: 'custom',
					renderComponent: AssignmentDateCellComponent,
					componentInitFunction: (instance: AssignmentDateCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				_status: {
					title: 'Status',
					type: 'custom',
					width: '90px',
					renderComponent: AssignmentStatusCellComponent,
					componentInitFunction: (instance: AssignmentStatusCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				_access: {
					title: 'Access',
					type: 'custom',
					width: '80px',
					filter: false,
					sort: false,
					renderComponent: AccessToggleCellComponent,
					componentInitFunction: (instance: AccessToggleCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						pipeUntilDestroyed(instance.toggled).subscribe(onToggle);
					}
				},
				_actions: {
					title: '',
					type: 'custom',
					width: '60px',
					filter: false,
					sort: false,
					renderComponent: UnassignActionCellComponent,
					componentInitFunction: (instance: UnassignActionCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						pipeUntilDestroyed(instance.unassign).subscribe((a) =>
							onUnassign(this.adaptRowToAssignment(a))
						);
					}
				}
			},
			hideSubHeader: true,
			actions: false,
			noDataMessage: 'No users assigned to this plugin',
			pager: { display: false, perPage: 10, page: 1 }
		};
	}

	/**
	 * Adapt a flat table row back to a PluginUserAssignment domain object.
	 * The row contains all assignment fields (spread via mapAssignmentToRow),
	 * but the component emits the looser UnassignRowData type.
	 */
	private adaptRowToAssignment(row: UnassignRowData): PluginUserAssignment {
		return {
			id: row['id'] as string,
			userId: row.userId ?? '',
			pluginSubscriptionId: row['pluginSubscriptionId'] as string,
			assignedAt: row['assignedAt'] as Date,
			assignedBy: row['assignedBy'] as string,
			isActive: row['isActive'] as boolean,
			reason: row['reason'] as string | undefined,
			user: row['user'] as IUser | undefined
		};
	}

	/**
	 * Map a PluginUserAssignment domain object to a flat row suitable
	 * for angular2-smart-table rendering.
	 *
	 * @param assignment - The assignment to flatten
	 */
	mapAssignmentToRow(assignment: PluginUserAssignment): Record<string, unknown> {
		return {
			...assignment,
			firstName: assignment.user?.firstName,
			lastName: assignment.user?.lastName,
			email: assignment.user?.email,
			imageUrl: assignment.user?.imageUrl,
			_user: `${assignment.user?.firstName || ''} ${assignment.user?.lastName || ''}`.trim(),
			_assignedAt: assignment.assignedAt,
			_status: assignment.isActive
		};
	}
}
