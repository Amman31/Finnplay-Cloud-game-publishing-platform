from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException

from app.db_url import require_postgresql_url

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _get_db_url() -> str:
    return require_postgresql_url()


@router.get("/{user_id}")
def recommendations(user_id: str) -> dict[str, Any]:
    query = """
    WITH user_categories AS (
      SELECT g.category, COUNT(*)::int AS weight
      FROM purchases p
      JOIN games g ON g.id = p."gameId"
      WHERE p."userId" = %(user_id)s AND p.status = 'completed'
      GROUP BY g.category
    ),
    game_scores AS (
      SELECT
        g.id,
        g.title,
        g.category,
        COALESCE(uc.weight, 0) * 5
          + COALESCE(v.view_count, 0) * 0.05
          + COALESCE(d.download_count, 0) * 0.5 AS score
      FROM games g
      LEFT JOIN user_categories uc ON uc.category = g.category
      LEFT JOIN (
        SELECT "gameId", COUNT(*)::int AS view_count
        FROM analytics
        WHERE "eventType" = 'view'
        GROUP BY "gameId"
      ) v ON v."gameId" = g.id
      LEFT JOIN (
        SELECT "gameId", COUNT(*)::int AS download_count
        FROM analytics
        WHERE "eventType" = 'download'
        GROUP BY "gameId"
      ) d ON d."gameId" = g.id
      WHERE g.published = true
        AND g.id NOT IN (
          SELECT "gameId" FROM purchases
          WHERE "userId" = %(user_id)s AND status = 'completed'
        )
    )
    SELECT id, title, category, score
    FROM game_scores
    ORDER BY score DESC, title ASC
    LIMIT 10;
    """
    try:
        with psycopg.connect(_get_db_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(query, {"user_id": user_id})
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recommendation query failed: {exc}") from exc

    return {
        "userId": user_id,
        "source": "python-service",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "recommendations": [
            {"gameId": row[0], "title": row[1], "category": row[2], "score": float(row[3]), "reason": "category-affinity"}
            for row in rows
        ],
    }
