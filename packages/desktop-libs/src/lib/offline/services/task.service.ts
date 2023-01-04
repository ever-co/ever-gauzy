import { ITaskFilterOption, ITaskService } from "../../interfaces";
import { TaskTO } from "../dto";

export class TaskService implements ITaskService<TaskTO> {
    save(task: TaskTO): Promise<void> {
        throw new Error("Method not implemented.");
    }
    synced(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    findAll(): Promise<TaskTO[]> {
        throw new Error("Method not implemented.");
    }
    findById(task: Partial<TaskTO>): Promise<TaskTO> {
        throw new Error("Method not implemented.");
    }
    findByFilter(options: ITaskFilterOption): Promise<TaskTO[]> {
        throw new Error("Method not implemented.");
    }
    remove(task: Partial<TaskTO>): Promise<void> {
        throw new Error("Method not implemented.");
    }
}