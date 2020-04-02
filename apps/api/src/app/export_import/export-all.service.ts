import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Subject } from 'rxjs';
import { CountryService } from '../country';
import * as csv from 'csv-writer';
import { UserService } from '../user';
import { UserOrganizationService } from '../user-organization';
import { EmailService } from '../email';
import { EmailTemplateService } from '../email-template';
import { EmployeeService } from '../employee/employee.service';
import { OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { EmployeeRecurringExpenseService } from '../employee-recurring-expense';
import { EmployeeSettingService } from '../employee-setting';
import { EquipmentService } from '../equipment';
import { EquipmentSharingService } from '../equipment-sharing';
import { ExpenseService } from '../expense';
import { ExpenseCategoriesService } from '../expense-categories';
import { IncomeService } from '../income/income.service';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class ExportAllService implements OnDestroy {
	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');
	private _ngDestroy$ = new Subject<void>();
	private services = [
		{ service: this.countryService, nameFile: 'countries' },
		{ service: this.userService, nameFile: 'users' },
		{
			service: this.userOrganizationService,
			nameFile: 'user_organization'
		},
		{ service: this.emailService, nameFile: 'email' },
		{ service: this.emailTemplate, nameFile: 'email_template' },
		{ service: this.employeeService, nameFile: 'employee' },
		{
			service: this.employeeRecurringExpensesService,
			nameFile: 'employee_recurring_expense'
		},
		{ service: this.employeeSettingService, nameFile: 'employee_setting' },
		{ service: this.equpmentService, nameFile: 'equipment' },
		{
			service: this.equipmentSharingService,
			nameFile: 'equipment_sharing'
		},
		{ service: this.expenseService, nameFile: 'expense' },
		{
			service: this.expenseCategoriesService,
			nameFile: 'expense_category'
		},
		{ service: this.incomeService, nameFile: 'income' },
		{ service: this.inviteService, nameFile: 'invite' }
	];

	constructor(
		private countryService: CountryService,
		private userService: UserService,
		private userOrganizationService: UserOrganizationService,
		private emailService: EmailService,
		private emailTemplate: EmailTemplateService,
		private employeeService: EmployeeService,
		private employeeRecurringExpensesService: EmployeeRecurringExpenseService,
		private employeeSettingService: EmployeeSettingService,
		private equpmentService: EquipmentService,
		private equipmentSharingService: EquipmentSharingService,
		private expenseService: ExpenseService,
		private expenseCategoriesService: ExpenseCategoriesService,
		private incomeService: IncomeService,
		private inviteService: InviteService
	) {}

	async createFolders(): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.idCsv.next(id);
			fs.access(`./export/${id}/csv`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(
						`./export/${id}/csv`,
						{ recursive: true },
						(err) => {
							if (err) reject(err);
							resolve();
						}
					);
				}
			});
		});
	}

	async archiveAndDownload(): Promise<any> {
		return new Promise((resolve, reject) => {
			{
				const id = uuidv4();
				const fileNameS = id + '_export.zip';
				this.idZip.next(fileNameS);

				const output = fs.createWriteStream(`./export/${fileNameS}`);

				const archive = archiver('zip', {
					zlib: { level: 9 }
				});

				output.on('close', function() {
					resolve();
				});

				output.on('end', function() {
					console.log('Data has been drained');
				});

				archive.on('warning', function(err) {
					if (err.code === 'ENOENT') {
						reject(err);
					} else {
						console.log('Unexpected error!');
					}
				});

				archive.on('error', function(err) {
					reject(err);
				});

				let id$ = '';
				this.idCsv
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((idCsv) => {
						id$ = idCsv;
					});

				archive.pipe(output);
				archive.directory(`./export/${id$}/csv`, false);
				archive.finalize();
			}
		});
	}

	async getAsCsv(service_count: number): Promise<any> {
		const incommingData = (
			await this.services[service_count].service.findAll()
		).items;

		if (incommingData[0] !== undefined) {
			return new Promise((resolve, reject) => {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];

				const dataKeys = Object.keys(incommingData[0]);

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `./export/${id$}/csv/${this.services[service_count].nameFile}.csv`,
					header: dataIn
				});

				const data = incommingData;

				csvWriter.writeRecords(data).then(() => {
					resolve();
				});
			});
		}
	}

	async downloadToUser(res): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';

			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((filename) => {
					fileName = filename;
				});
			res.download(`./export/${fileName}`);

			resolve();
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve, reject) => {
			let id$ = '';

			this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
				id$ = id;
			});

			fs.access(`./export/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${id$}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}
	async deleteArchive(): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';
			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((fileName$) => {
					fileName = fileName$;
				});

			fs.access(`./export/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${fileName}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}

	async exportTables() {
		return new Promise(async (resolve, reject) => {
			for (const [i, value] of this.services.entries()) {
				await this.getAsCsv(i);
			}
			resolve();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
