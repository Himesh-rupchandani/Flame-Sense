import { getDb } from '../database.ts';
import { RANKING_WEIGHTS, computeCrewSafetyRelevance } from '../../src/data/nasaExperiments.ts';
import { listExperiments } from './experimentService.ts';

export function getComputedRankings() {
  const db = getDb();
  const experiments = listExperiments();

  // Recompute directly from persisted database criteria rows & defined weights
  const scored = experiments
    .map((exp) => {
      const score = computeCrewSafetyRelevance(exp.criteria);
      return { exp, score };
    })
    .sort((a, b) => b.score - a.score);

  const updateStmt = db.prepare(`
    UPDATE experiment_rankings
    SET computed_relevance_score = ?, rank_position = ?, updated_at = ?
    WHERE experiment_id = ?
  `);

  const nowIso = new Date().toISOString();
  db.exec('BEGIN');
  try {
    scored.forEach((item, index) => {
      updateStmt.run(item.score, index + 1, nowIso, item.exp.id);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    methodology: {
      version: 'NASA-Weighted-v1.0',
      description:
        'Weighted multi-criteria evaluation across six empirical NASA crew fire-safety dimensions persisted in experiment_rankings with no hardcoded score overrides.',
      weights: RANKING_WEIGHTS,
    },
    rankings: scored.map((item, idx) => ({
      ...item.exp,
      rank: idx + 1,
      relevanceScore: item.score,
    })),
  };
}
