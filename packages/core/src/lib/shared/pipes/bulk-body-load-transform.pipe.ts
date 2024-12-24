import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class BulkBodyLoadTransformPipe implements PipeTransform<string>  {

    transform(value: string, metadata: ArgumentMetadata) {
        return { list : value }
    }
    
}