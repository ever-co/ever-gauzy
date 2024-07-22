import { Observable } from "rxjs/internal/Observable";
import { IPagination } from "@gauzy/contracts";

export interface ICrudService<T> {

    create(t: T): Observable<T> | Promise<T>;
    update(id: string, t: T): Observable<T> | Promise<T>;
    get(t: Partial<T>): Observable<IPagination<T>> | Promise<IPagination<T>>;
    delete(id: string, t: T): Observable<any> | Promise<any>;
}
