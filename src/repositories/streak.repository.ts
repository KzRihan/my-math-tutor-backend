/**
 * Streak Repository
 *
 * Handles data access for streak documents.
 */

import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { Streak, StreakDocument } from '@domain/models/streak.model';
import { IStreak } from '@domain/interfaces/streak.interface';

@injectable()
export class StreakRepository extends BaseRepository<IStreak, StreakDocument> {
  constructor() {
    super(Streak);
  }

  async findByUserId(userId: string): Promise<StreakDocument | null> {
    return this.findOne({ userId } as any);
  }
}
