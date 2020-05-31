import { ServiceLike } from './service-like';
import { BaseEntityModel } from '@gauzy/models';
import { deepCopy } from '@fullcalendar/angular/lib/utils';



export class Service<E extends BaseEntityModel, CI, UI = Partial<CI>, ID = string> implements ServiceLike<E, CI, UI, ID>
{

  protected entries: E[] = [];

  public async create( create: CI ): Promise<E>
  {
    this.entries.push({
      id: btoa( `${ Date.now() }.${ Math.random() }` ),
      ...create,
    } as any);

    return this.entries.reverse()[ 0 ];
  }

  public async delete( id: ID ): Promise<void>
  {
    const entry = await this.find( id );
    const index = this.entries.indexOf( entry );

    this.entries.splice( index, 1 );
  }

  public find( id: ID ): Promise<E>;
  public find( filter?: Pick<E, Exclude<keyof E, "id">> ): Promise<E[]>;
  public async find( idOrFilter?: ID | Pick<E, Exclude<keyof E, "id">> ): Promise<E | E[]>
  {
    if ( void 0 === idOrFilter ) {
      return this.entries;
    } else if ( 'string' === typeof idOrFilter ) {
      const entry = this.entries.find( ({ id }) => id === idOrFilter );

      if ( !entry ) {
        throw new Error( 'Not found - { id: "' + idOrFilter + '" }' );
      }

      return entry;
    }

    return this.entries.filter( entry =>
      Object.keys( idOrFilter )
        .every( key => idOrFilter[ key ] === entry[ key ] ) );
  }

  public async update( id: ID, update: UI ): Promise<E>
  {
    const entry = await this.find( id );

    return Object.assign( entry, update );
  }
}
