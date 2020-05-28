import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AttributeValidator, AttributeValidatorCreateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';



@Injectable()
export class AttributeValidatorsService
{

  private ROOT_URL = '/api/attribute-validators'

  public constructor( private http: HttpClient ) {}

  public create( createInput: AttributeValidatorCreateInput ): Promise<AttributeValidator> {
    return this.http.post<AttributeValidator>( this.ROOT_URL, createInput )
      .pipe( first() ).toPromise();
  }

  public getAll(): Promise<AttributeValidator[]> {
    return this.http.get<AttributeValidator[]>( this.ROOT_URL )
      .pipe( first() ).toPromise();
  }

}
