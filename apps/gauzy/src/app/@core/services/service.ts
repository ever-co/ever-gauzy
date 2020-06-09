import { BaseEntityModel } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

export abstract class Service<BE extends BaseEntityModel, FI = Partial<BE>, CI = Partial<BE>>
{

  protected basePath: string;

  protected http: HttpClient;

  protected constructor({ http, basePath }: {
    basePath: string;
    http: HttpClient;
  })
  {
    this.basePath = basePath;
    this.http = http;
  }

  public create( data: CI ): Promise<BE> {
    return this.http.post<BE>( this.basePath, data )
      .pipe( first() )
      .toPromise();
  }

  public find<L extends { items: BE[], total: number }>(): Promise<L>;
  public find( id: string ): Promise<BE>;
  public find<L extends { items: BE[], total: number }>( relations: string[], filter: FI ): Promise<L>;
  public find<LBE extends { items: BE[], total: number }>( idOrRelations?: string | string[], filter?: FI ): Promise<BE | LBE> {
    if ( !arguments.length ) {
      return this.http
        .get<LBE>( this.basePath ).toPromise();
    } else if ( 'string' === typeof idOrRelations ) {
      return this.http
        .get<BE>( `${ this.basePath }/${ idOrRelations }` )
        .pipe( first() ).toPromise();
    }

    return this.http
      .get<LBE>( this.basePath, {
        params: {
          data: JSON.stringify({
            relations: idOrRelations,
            filter,
          }),
        },
      })
      .toPromise();
  }

  public update( id: string, data: CI ): Promise<BE> {
    return this.http
      .put<BE>( `${ this.basePath }/${ id }`, data )
      .pipe( first() )
      .toPromise();
  }

  public delete( id: string ): Promise<unknown> {
    return this.http
      .delete( `${ this.basePath }/${ id }` )
      .pipe( first() )
      .toPromise();
  }

}
