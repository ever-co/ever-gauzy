import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { IFilterConfig, LocalDataSource } from 'angular2-smart-table';
import { isNotEmpty, toParams } from '@gauzy/ui-sdk/common';
import { ServerSourceConf } from './server-source.conf';

export class ServerDataSource extends LocalDataSource {
	protected conf: ServerSourceConf;
	protected lastRequestCount: number = 0;

	constructor(protected http: HttpClient, conf: ServerSourceConf | {} = {}) {
		super();
		this.conf = new ServerSourceConf(conf);
		if (!this.conf.endPoint) {
			throw new Error('At least endPoint must be specified as a configuration of the server data source.');
		}
	}

	count(): number {
		return this.lastRequestCount;
	}

	getData(): any[] {
		return this.data;
	}

	getElements(): Promise<any> {
		return firstValueFrom(
			this.requestElements().pipe(
				map((res) => {
					this.lastRequestCount = this.extractTotalFromResponse(res);
					this.data = this.extractDataFromResponse(res);
					return this.data;
				}),
				tap(() => {
					if (this.conf.finalize) {
						this.conf.finalize();
					}
				}),
				catchError((error) => {
					if (this.conf.finalize) {
						this.conf.finalize();
					}
					// failed from server then call finalize method
					throw new Error(error);
				})
			)
		);
	}

	/**
	 * Extracts array of data from server response
	 * @param res
	 * @returns {any}
	 */
	protected extractDataFromResponse(res: any): Array<any> {
		const rawData = res.body;
		let data = !!this.conf.dataKey ? rawData[this.conf.dataKey] : rawData;
		try {
			if (data instanceof Array) {
				return this.conf.resultMap ? data.map(this.conf.resultMap).filter(Boolean) : data;
			}
			throw new Error(
				`Data must be an array. Please check that data extracted from the server response by the key '${this.conf.dataKey}' exists and is array.`
			);
		} catch (error) {
			console.log(`Failed to extract data from response: ${error}`);
			return data;
		}
	}

	/**
	 * Extracts total rows count from the server response
	 * Looks for the count in the headers first, then in the response body
	 * @param res
	 * @returns {any}
	 */
	protected extractTotalFromResponse(res: any): number {
		if (res.headers.has(this.conf.totalKey)) {
			return +res.headers.get(this.conf.totalKey);
		} else {
			const rawData = res.body;
			return rawData[this.conf.totalKey] || 0;
		}
	}

	protected requestElements(): Observable<any> {
		let httpParams = this.createRequestParams();
		return this.http.get(this.conf.endPoint, { params: httpParams, observe: 'response' });
	}

	protected createRequestParams(): HttpParams {
		const requestParams = {
			...(this.conf.where ? { where: this.conf.where } : {}),
			...(this.conf.join ? { join: this.conf.join } : {}),
			...(this.conf.relations ? { relations: this.conf.relations } : {}),
			...(this.conf.withDeleted ? { withDeleted: this.conf.withDeleted } : {}),
			...(isNotEmpty(this.conf.select) ? { select: this.conf.select } : {}),
			...this.addSortRequestParams(),
			...this.addFilterRequestParams(),
			...this.addPagerRequestParams()
		};
		return toParams(requestParams);
	}

	protected addSortRequestParams() {
		if (this.sortConf) {
			const orders: any = {};
			this.sortConf.forEach((fieldConf) => {
				orders[fieldConf.field] = fieldConf.direction.toUpperCase();
			});
			return {
				[this.conf.sortDirKey]: orders
			};
		} else {
			return {};
		}
	}

	/**
	 * Add additional smart datatables filters to the request parameters.
	 *
	 * @returns {Object} The constructed filter object for request parameters.
	 */
	protected addFilterRequestParams(): any {
		// Check if filter configuration is defined
		if (!this.filterConf) {
			// If not defined, return an empty object
			return {};
		}

		// Initialize an object to store filter values
		const filters: any = {};

		// Iterate over each filter configuration
		this.filterConf.forEach(({ field, search }: IFilterConfig) => {
			// Check if search value is truthy, and add it to filters
			if (search) {
				filters[field] = search;
			}
		});

		// Construct and return the final filter object with the specified key
		return {
			[this.conf.filterFieldKey]: filters
		};
	}

	protected addPagerRequestParams() {
		try {
			if (this.pagingConf) {
				if (typeof this.pagingConf['page'] === 'number' && typeof this.pagingConf['perPage'] === 'number') {
					return {
						[this.conf.pagerPageKey]: this.pagingConf['page'],
						[this.conf.pagerLimitKey]: this.pagingConf['perPage']
					};
				}
				return {};
			} else {
				return {};
			}
		} catch (error) {
			console.log('Error while retrieving pagination configuration', error);
			return {};
		}
	}
}
