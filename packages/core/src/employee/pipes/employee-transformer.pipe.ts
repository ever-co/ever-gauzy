import { ArgumentMetadata, PipeTransform } from "@nestjs/common";

export class EmployeeBodyPayLoadTransform  implements PipeTransform<string>{

    public transform(value: string, metadata: ArgumentMetadata): any {
        return {list:value};
    }

}