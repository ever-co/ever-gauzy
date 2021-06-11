import { HttpService, Injectable } from "@nestjs/common";
import { Observable } from "rxjs/internal/Observable";

@Injectable()
export class GauzyCloudService {

    constructor(private readonly httpService: HttpService) {}

    findAll(): Observable<any> {
        return this.httpService.get('http://localhost:3000/cats');
    }
}