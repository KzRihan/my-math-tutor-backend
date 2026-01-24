/**
 * Base Repository
 * 
 * Generic repository providing common CRUD operations for all entities.
 * Implements the repository pattern for data access abstraction.
 */

import {
    Model,
    FilterQuery,
    UpdateQuery,
    QueryOptions,
    PipelineStage,
    HydratedDocument,
} from 'mongoose';

/**
 * Pagination options
 */
export interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

/**
 * Base repository abstract class
 * Provides common CRUD operations using generics
 * T = the document interface, D = the hydrated document type
 */
export abstract class BaseRepository<T, D extends HydratedDocument<T>> {
    constructor(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        protected readonly model: Model<any>
    ) { }

    /**
     * Create a new document
     */
    async create(data: Partial<T>): Promise<D> {
        const document = new this.model(data);
        return document.save() as Promise<D>;
    }

    /**
     * Create multiple documents
     */
    async createMany(data: Partial<T>[]): Promise<D[]> {
        return this.model.insertMany(data) as Promise<D[]>;
    }

    /**
     * Find by ID
     */
    async findById(id: string): Promise<D | null> {
        return this.model.findById(id).exec() as Promise<D | null>;
    }

    /**
     * Find one by query
     */
    async findOne(filter: FilterQuery<T>): Promise<D | null> {
        return this.model.findOne(filter).exec() as Promise<D | null>;
    }

    /**
     * Find all matching query
     */
    async findAll(filter: FilterQuery<T> = {}): Promise<D[]> {
        return this.model.find(filter).exec() as Promise<D[]>;
    }

    /**
     * Find with pagination
     */
    async findPaginated(
        filter: FilterQuery<T>,
        options: PaginationOptions
    ): Promise<PaginatedResult<D>> {
        const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

        const skip = (page - 1) * limit;
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const [data, total] = await Promise.all([
            this.model
                .find(filter)
                .sort({ [sortBy]: sortDirection } as Record<string, 1 | -1>)
                .skip(skip)
                .limit(limit)
                .exec() as Promise<D[]>,
            this.model.countDocuments(filter).exec(),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }

    /**
     * Update by ID
     */
    async updateById(
        id: string,
        update: UpdateQuery<T>,
        options: QueryOptions = { new: true }
    ): Promise<D | null> {
        return this.model.findByIdAndUpdate(id, update, options).exec() as Promise<D | null>;
    }

    /**
     * Update one by query
     */
    async updateOne(
        filter: FilterQuery<T>,
        update: UpdateQuery<T>,
        options: QueryOptions = { new: true }
    ): Promise<D | null> {
        return this.model.findOneAndUpdate(filter, update, options).exec() as Promise<D | null>;
    }

    /**
     * Update many by query
     */
    async updateMany(
        filter: FilterQuery<T>,
        update: UpdateQuery<T>
    ): Promise<{ matchedCount: number; modifiedCount: number }> {
        const result = await this.model.updateMany(filter, update).exec();
        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    }

    /**
     * Delete by ID
     */
    async deleteById(id: string): Promise<D | null> {
        return this.model.findByIdAndDelete(id).exec() as Promise<D | null>;
    }

    /**
     * Delete one by query
     */
    async deleteOne(filter: FilterQuery<T>): Promise<D | null> {
        return this.model.findOneAndDelete(filter).exec() as Promise<D | null>;
    }

    /**
     * Delete many by query
     */
    async deleteMany(filter: FilterQuery<T>): Promise<number> {
        const result = await this.model.deleteMany(filter).exec();
        return result.deletedCount;
    }

    /**
     * Count documents
     */
    async count(filter: FilterQuery<T> = {}): Promise<number> {
        return this.model.countDocuments(filter).exec();
    }

    /**
     * Check if document exists
     */
    async exists(filter: FilterQuery<T>): Promise<boolean> {
        const result = await this.model.exists(filter);
        return result !== null;
    }

    /**
     * Run aggregation pipeline
     */
    async aggregate<R>(pipeline: PipelineStage[]): Promise<R[]> {
        return this.model.aggregate(pipeline).exec();
    }

    /**
     * Distinct values for a field
     */
    async distinct(
        field: string,
        filter: FilterQuery<T> = {}
    ): Promise<unknown[]> {
        return this.model.distinct(field, filter).exec();
    }
}

export default BaseRepository;
