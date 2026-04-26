from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException

from app.db_url import require_postgresql_url

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _get_db_url() -> str:
    return require_postgresql_url()


@router.get("/trending")
def trending() -> dict[str, Any]:
    query = """
    SELECT
      g.id,
      g.title,
      COUNT(*) FILTER (WHERE a."eventType" = 'view')::int AS views,
      COUNT(*) FILTER (WHERE a."eventType" = 'download')::int AS downloads
    FROM games g
    LEFT JOIN analytics a ON a."gameId" = g.id
    WHERE g.published = true
    GROUP BY g.id, g.title
    ORDER BY (COUNT(*) FILTER (WHERE a."eventType" = 'download')) * 2
      + (COUNT(*) FILTER (WHERE a."eventType" = 'view')) DESC
    LIMIT 10;
    """
    try:
        with psycopg.connect(_get_db_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Trending query failed: {exc}") from exc

    trending_games = []
    for index, row in enumerate(rows):
        score = row[3] * 2 + row[2]
        trending_games.append(
            {
                "rank": index + 1,
                "gameId": row[0],
                "title": row[1],
                "views": row[2],
                "downloads": row[3],
                "score": score,
            }
        )

    return {
        "source": "python-service",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "trending": trending_games,
    }
