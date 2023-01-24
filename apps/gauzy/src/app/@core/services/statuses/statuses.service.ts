import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { IStatus } from "@gauzy/contracts";
import { CrudService } from "../crud/crud.service";
import { API_PREFIX } from "../../constants";

@Injectable()
export class StatusesService extends CrudService<IStatus> {

    static readonly API_URL = `${API_PREFIX}/statuses`;

    constructor(
        protected readonly http: HttpClient
    ) {
        super(http, StatusesService.API_URL);
    }
}
