import { HttpService, Injectable } from "@nestjs/common";
import { IUserRegistrationInput } from "@gauzy/contracts";
import { map } from "rxjs/operators";

@Injectable()
export class GauzyCloudService {

    constructor(
        private readonly _http: HttpService
    ) {}
    
    migrateUser(
        payload: IUserRegistrationInput
    ) {        
        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/register', params).pipe(
                map((response) => {
                    console.log(response, 'response');
                    return response.data;
                }),
            );
    }
}