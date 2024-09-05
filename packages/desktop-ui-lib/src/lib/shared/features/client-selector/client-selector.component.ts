import { Component } from '@angular/core';
import { IOrganizationContact } from 'packages/contracts/dist';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { ClientSelectorQuery } from './+state/client-selector.query';
import { ClientSelectorService } from './+state/client-selector.service';
import { ClientSelectorStore } from './+state/client-selector.store';

@Component({
	selector: 'gauzy-client-selector',
	templateUrl: './client-selector.component.html',
	styleUrls: ['./client-selector.component.scss']
})
export class ClientSelectorComponent {
	constructor(
		private readonly electronService: ElectronService,
		public readonly clientSelectorStore: ClientSelectorStore,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		private readonly clientSelectorService: ClientSelectorService
	) {}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addContact = async (name: IOrganizationContact['name']) => {
		return this.clientSelectorService.addContact(name);
	};

	public get error$(): Observable<string> {
		return this.clientSelectorQuery.selectError();
	}

	public get selectedId$(): Observable<string> {
		return this.clientSelectorQuery.selectedId$;
	}

	public get data$(): Observable<IOrganizationContact[]> {
		return this.clientSelectorQuery.data$;
	}

	public change(clientId: IOrganizationContact['id']) {
		this.clientSelectorStore.updateSelected(clientId);
	}
}
