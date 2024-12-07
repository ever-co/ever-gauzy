import { Transform, TransformFnParams } from "class-transformer";

export function Trimmed(): PropertyDecorator {
    return Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null));
}
