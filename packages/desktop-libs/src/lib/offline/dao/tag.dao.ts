import { DAO } from "../../interfaces";
import { TagTO } from "../dto";

export class TagDAO implements DAO<TagTO> {
    findAll(): Promise<TagTO[]> {
        throw new Error("Method not implemented.");
    }
    save(value: TagTO): Promise<void> {
        throw new Error("Method not implemented.");
    }
    findOneById(id: number): Promise<TagTO> {
        throw new Error("Method not implemented.");
    }
    update(id: number, value: Partial<TagTO>): Promise<void> {
        throw new Error("Method not implemented.");
    }
    delete(value: Partial<TagTO>): Promise<void> {
        throw new Error("Method not implemented.");
    }
}