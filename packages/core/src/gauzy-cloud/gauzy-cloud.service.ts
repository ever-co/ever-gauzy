import { HttpService, Injectable } from "@nestjs/common";
import { IUserRegistrationInput } from "@gauzy/contracts";
import { map } from "rxjs/operators";

@Injectable()
export class GauzyCloudService {

    constructor(
        private readonly _http: HttpService
    ) {}
    
    migrateUser(payload: IUserRegistrationInput) {
        console.log(payload);

        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/register', params, {
                headers: {
                    'Content-Type': 'application/json',
                }
            }).pipe(
                map((response) => {
                    console.log(response);
                    return response.data;
                }),
            );
    }
}