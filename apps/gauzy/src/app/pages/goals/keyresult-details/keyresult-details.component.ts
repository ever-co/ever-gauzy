import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { KeyResult, KeyResultUpdates } from '@gauzy/models';
import { KeyresultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first } from 'rxjs/operators';
import { KeyresultService } from '../../../@core/services/keyresult.service';
import { Subject } from 'rxjs';
import { KeyresultUpdateService } from '../../../@core/services/keyresult-update.service';

@Component({
	selector: 'ga-keyresult-details',
	templateUrl: './keyresult-details.component.html',
	styleUrls: ['./keyresult-details.component.scss']
})
export class KeyresultDetailsComponent implements OnInit, OnDestroy {
	owner: string;
	src: string;
	keyResult: KeyResult;
	updates: KeyResultUpdates[];
	private _ngDestroy$ = new Subject<void>();
	ownerName: string;
	constructor(
		private dialogRef: NbDialogRef<KeyresultDetailsComponent>,
		private employeeService: EmployeesService,
		private dialogService: NbDialogService,
		private keyresultService: KeyresultService,
		private keyresultUpdateService: KeyresultUpdateService
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.owner,
			['user']
		);
		console.log(this.keyResult);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
		this.updates = this.keyResult.updates.sort(
			(a, b) =>
				new Date(a.createdAt).getUTCSeconds() -
				new Date(b.createdAt).getUTCSeconds()
		);
	}

	async loadModal() {
		await this.keyresultService
			.findKeyResult(this.keyResult.id)
			.then((keyresult) => {
				console.log(keyresult);
				this.keyResult = keyresult.items[0];
				this.updates = keyresult.items[0].updates;
			});
	}

	async keyResultUpdate() {
		const dialog = this.dialogService.open(KeyresultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: this.keyResult
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			console.log(response);

			try {
				const update: KeyResultUpdates = {
					keyresult_id: this.keyResult.id,
					owner: response.owner,
					update: response.update,
					progress: response.progress,
					status: response.status
				};

				delete response.updates;

				await this.keyresultUpdateService
					.createUpdate(update)
					.then(async (res) => {
						if (res) {
							await this.keyresultService
								.update(this.keyResult.id, response)
								.then((updateRes) => {
									if (updateRes) {
										this.loadModal();
									}
								});
						}
					});
			} catch (error) {
				console.log(error);
			}
		}
	}

	closeDialog() {
		this.dialogRef.close(this.keyResult);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
