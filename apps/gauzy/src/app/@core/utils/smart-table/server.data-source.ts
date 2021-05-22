import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ServerSourceConf } from './server-source.conf';
import { LocalDataSource } from 'ng2-smart-table';

import { map } from 'rxjs/operators';
import { toParams } from '@gauzy/common-angular';

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
        return this.requestElements()
            .pipe(map(res => {
                this.lastRequestCount = this.extractTotalFromResponse(res);
                this.data = this.extractDataFromResponse(res);
                return this.data;
            })).toPromise();
    }

    /**
    * Extracts array of data from server response
    * @param res
    * @returns {any}
    */
    protected extractDataFromResponse(res: any): Array<any> {
        const rawData = res.body;
        const data = !!this.conf.dataKey ? rawData[this.conf.dataKey] : rawData;
        if (data instanceof Array) {
            return this.conf.resultMap ? data.map(this.conf.resultMap) : data;
        }
        throw new Error(`Data must be an array. Please check that data extracted from the server response by the key '${this.conf.dataKey}' exists and is array.`);
    }

    /**
    * Extracts total rows count from the server response
    * Looks for the count in the heders first, then in the response body
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
            ...(this.conf.where ? {where: this.conf.where} : {}),
            ...(this.conf.join ? {join: this.conf.join} : {}),
            ...(this.conf.relations ? {relations: this.conf.relations} : {}),
            ...this.addSortRequestParams(),
            ...this.addFilterRequestParams(),
            ...this.addPagerRequestParams(),
        }
        return toParams(requestParams);
    }

    protected addSortRequestParams() {
        if (this.sortConf) {
            const orders:any = {}
            this.sortConf.forEach((fieldConf) => {
                orders[fieldConf.field] = fieldConf.direction.toUpperCase();
            });
            return {
                [this.conf.sortFieldKey]: orders
            }
        } else {
            return {}
        }
    }

    protected addFilterRequestParams() {
        if (this.filterConf.filters) {
            const filters: any = {}
            this.filterConf.filters.forEach((fieldConf) => {
                filters[fieldConf['field']] = {
                    dataType:  fieldConf['dataType'] || 'string',
                    condition: fieldConf['condition'] || 'ILike',
                    search: fieldConf['search'] || '',
                }
                filters[fieldConf.field] = fieldConf.direction.toUpperCase();
            });
            return {
                [this.conf.filterFieldKey]: filters
            }
        } else {
            return {}
        }
    }

    protected addPagerRequestParams() {
        if (this.pagingConf && this.pagingConf['page'] && this.pagingConf['perPage']) {
            return {
                [this.conf.pagerPageKey]: this.pagingConf['page'],
                [this.conf.pagerLimitKey]: this.pagingConf['perPage']
            }
        } else {
            return {}
        }
    }
}