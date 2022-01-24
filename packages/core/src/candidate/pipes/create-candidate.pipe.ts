import { ArgumentMetadata, PipeTransform } from "@nestjs/common";

export class CandidateBodyPayloadTransform implements PipeTransform<string>{
    
    transform(value: string, metadata: ArgumentMetadata) {
        return { list : value }
    }
    
}