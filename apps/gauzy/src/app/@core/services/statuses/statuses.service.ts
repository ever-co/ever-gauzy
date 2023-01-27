import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { ITaskStatus } from "@gauzy/contracts";
import { CrudService } from "../crud/crud.service";
import { API_PREFIX } from "../../constants";

@Injectable()
export class StatusesService extends CrudService<ITaskStatus> {

    static readonly API_URL = `${API_PREFIX}/task-statuses`;

    constructor(
        protected readonly http: HttpClient
    ) {
        super(http, StatusesService.API_URL);
    }
}
