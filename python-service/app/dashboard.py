"""
Admin analytics dashboard — aggregates purchases, games, ratings, analytics, ads in PostgreSQL.
Response shape matches the former Express/Prisma JSON so the Next.js admin UI stays unchanged.

Uses lowercase SQL aliases + dict_row so keys match reliably across PostgreSQL/psycopg versions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from app.db_url import require_postgresql_url

router = APIRouter(prefix="/analytics", tags=["dashboard"])


def _db_url() -> str:
    return require_postgresql_url()


def _connect():
    return psycopg.connect(_db_url(), row_factory=dict_row)


def _fnum(v: Any) -> float:
    if v is None:
        return 0.0
    return float(v)


def _int(v: Any) -> int:
    if v is None:
        return 0
    return int(v)


@router.get("/dashboard")
def analytics_dashboard() -> dict[str, Any]:
    """Full admin dashboard payload (same keys as legacy Node `getAnalyticsDashboard`)."""
    stage = "init"
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                stage = "totals"
                cur.execute(
                    """
                    SELECT
                      (SELECT COUNT(*)::int FROM users) AS total_users,
                      (SELECT COUNT(*)::int FROM games) AS total_games,
                      (SELECT COUNT(*)::int FROM games WHERE published = true) AS published_games,
                      (SELECT COUNT(*)::int FROM games WHERE published = false) AS draft_games,
                      (SELECT COALESCE(SUM("amount"), 0)::float FROM purchases WHERE "status" = 'completed') AS total_revenue,
                      (SELECT COUNT(*)::int FROM purchases WHERE "status" = 'completed') AS total_purchases,
                      (SELECT COALESCE(SUM("clicks"), 0)::float * 0.01 FROM ads) AS ad_revenue,
                      (SELECT COUNT(*)::int FROM analytics WHERE "eventType" = 'view') AS total_views,
                      (SELECT COUNT(*)::int FROM analytics WHERE "eventType" = 'play') AS total_plays,
                      (SELECT COUNT(*)::int FROM analytics WHERE "eventType" = 'download') AS total_downloads,
                      (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE AVG("rating"::double precision) END FROM ratings) AS avg_rating
                    FROM (SELECT 1) AS _dummy
                    """
                )
                g = cur.fetchone()
                assert g is not None

                stage = "games_with_stats"
                cur.execute(
                    """
                    SELECT
                      g.id AS id,
                      g.title AS title,
                      g.category AS category,
                      g.published AS published,
                      g."createdAt" AS created_at,
                      COALESCE(va.views, 0)::int AS views,
                      COALESCE(da.downloads, 0)::int AS downloads,
                      COALESCE(ra.avg_rating, 0)::double precision AS rating,
                      COALESCE(ra.cnt, 0)::int AS total_ratings,
                      COALESCE(pa.revenue, 0)::double precision AS revenue,
                      COALESCE(pa.pcnt, 0)::int AS purchases
                    FROM games g
                    LEFT JOIN (
                      SELECT "gameId", COUNT(*)::int AS views
                      FROM analytics WHERE "eventType" = 'view' GROUP BY "gameId"
                    ) va ON va."gameId" = g.id
                    LEFT JOIN (
                      SELECT "gameId", COUNT(*)::int AS downloads
                      FROM analytics WHERE "eventType" = 'download' GROUP BY "gameId"
                    ) da ON da."gameId" = g.id
                    LEFT JOIN (
                      SELECT "gameId", AVG("rating"::double precision) AS avg_rating, COUNT(*)::int AS cnt
                      FROM ratings GROUP BY "gameId"
                    ) ra ON ra."gameId" = g.id
                    LEFT JOIN (
                      SELECT "gameId", SUM("amount")::double precision AS revenue, COUNT(*)::int AS pcnt
                      FROM purchases WHERE "status" = 'completed' GROUP BY "gameId"
                    ) pa ON pa."gameId" = g.id
                    """
                )
                game_rows = cur.fetchall()

                stage = "time_series_events"
                cur.execute(
                    """
                    SELECT to_char("timestamp", 'YYYY-MM-DD') AS day, "eventType" AS event_type, COUNT(*)::int AS cnt
                    FROM analytics
                    WHERE "timestamp" >= NOW() - INTERVAL '30 days'
                      AND "eventType" IN ('view', 'download')
                    GROUP BY 1, 2
                    """
                )
                ts_events = cur.fetchall()

                stage = "time_series_revenue"
                cur.execute(
                    """
                    SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, SUM("amount")::double precision AS revenue
                    FROM purchases
                    WHERE "status" = 'completed'
                      AND "createdAt" >= NOW() - INTERVAL '30 days'
                    GROUP BY 1
                    """
                )
                ts_revenue = cur.fetchall()

                stage = "event_breakdown"
                cur.execute(
                    """
                    SELECT "eventType" AS event_type, COUNT(*)::int AS cnt
                    FROM analytics
                    GROUP BY "eventType"
                    """
                )
                event_rows = cur.fetchall()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dashboard query failed at [{stage}]: {exc}") from exc

    total_games = _int(g["total_games"])
    total_views = _int(g["total_views"])
    total_downloads = _int(g["total_downloads"])
    total_revenue = _fnum(g["total_revenue"])
    total_purchases = _int(g["total_purchases"])
    ad_revenue = _fnum(g["ad_revenue"])
    total_users = _int(g["total_users"])
    avg_rating = _fnum(g["avg_rating"])

    total_revenue_combined = total_revenue + ad_revenue
    avg_views = total_views / total_games if total_games else 0.0
    avg_downloads = total_downloads / total_games if total_games else 0.0
    conversion_rate = (total_downloads / total_views * 100.0) if total_views else 0.0
    purchase_rate = (total_purchases / total_users * 100.0) if total_users else 0.0

    games_with_stats: list[dict[str, Any]] = []
    for row in game_rows:
        created = row["created_at"]
        if isinstance(created, datetime):
            created_out = created.astimezone(timezone.utc).isoformat()
        else:
            created_out = str(created)
        games_with_stats.append(
            {
                "id": row["id"],
                "title": row["title"],
                "category": row["category"],
                "published": row["published"],
                "views": _int(row["views"]),
                "downloads": _int(row["downloads"]),
                "rating": _fnum(row["rating"]),
                "totalRatings": _int(row["total_ratings"]),
                "revenue": _fnum(row["revenue"]),
                "purchases": _int(row["purchases"]),
                "createdAt": created_out,
            }
        )

    top_by_views = sorted(games_with_stats, key=lambda x: x["views"], reverse=True)[:10]
    top_by_downloads = sorted(games_with_stats, key=lambda x: x["downloads"], reverse=True)[:10]
    top_by_revenue = sorted(games_with_stats, key=lambda x: x["revenue"], reverse=True)[:10]

    category_map: dict[str, dict[str, Any]] = {}
    for game in games_with_stats:
        cat = game["category"]
        if cat not in category_map:
            category_map[cat] = {"games": 0, "views": 0, "downloads": 0, "ratings": []}
        s = category_map[cat]
        s["games"] += 1
        s["views"] += game["views"]
        s["downloads"] += game["downloads"]
        if game["rating"] > 0:
            s["ratings"].append(game["rating"])

    category_stats = []
    for category, stats in category_map.items():
        rlist = stats["ratings"]
        avg_r = sum(rlist) / len(rlist) if rlist else 0.0
        category_stats.append(
            {
                "_id": category,
                "count": stats["games"],
                "totalViews": stats["views"],
                "totalDownloads": stats["downloads"],
                "avgRating": avg_r,
            }
        )

    event_breakdown = [{"_id": row["event_type"], "count": _int(row["cnt"])} for row in event_rows]

    views_by_date: dict[str, int] = {}
    downloads_by_date: dict[str, int] = {}
    for row in ts_events:
        day = str(row["day"])
        et = row["event_type"]
        c = _int(row["cnt"])
        if et == "view":
            views_by_date[day] = views_by_date.get(day, 0) + c
        elif et == "download":
            downloads_by_date[day] = downloads_by_date.get(day, 0) + c

    revenue_by_date = {str(row["day"]): _fnum(row["revenue"]) for row in ts_revenue}

    all_dates = sorted(set(views_by_date) | set(downloads_by_date) | set(revenue_by_date))
    time_series_views = [{"_id": d, "count": views_by_date.get(d, 0)} for d in all_dates]
    time_series_downloads = [{"_id": d, "count": downloads_by_date.get(d, 0)} for d in all_dates]
    time_series_revenue = [{"_id": d, "revenue": revenue_by_date.get(d, 0.0)} for d in all_dates]

    recent_games = sorted(games_with_stats, key=lambda x: x["createdAt"], reverse=True)[:10]

    return {
        "source": "python-service",
        "stats": {
            "totalGames": total_games,
            "publishedGames": _int(g["published_games"]),
            "draftGames": _int(g["draft_games"]),
            "totalViews": total_views,
            "totalPlays": _int(g["total_plays"]),
            "totalDownloads": total_downloads,
            "totalRevenue": total_revenue,
            "totalRevenueCombined": total_revenue_combined,
            "adRevenue": ad_revenue,
            "totalPurchases": total_purchases,
            "totalUsers": total_users,
            "avgViews": avg_views,
            "avgDownloads": avg_downloads,
            "avgRating": avg_rating,
            "conversionRate": conversion_rate,
            "purchaseRate": purchase_rate,
        },
        "topGames": {
            "byViews": top_by_views,
            "byDownloads": top_by_downloads,
            "byRevenue": top_by_revenue,
        },
        "categoryStats": category_stats,
        "eventBreakdown": event_breakdown,
        "timeSeries": {
            "views": time_series_views,
            "downloads": time_series_downloads,
            "revenue": time_series_revenue,
        },
        "recentGames": recent_games,
    }


@router.get("/revenue-breakdown")
def revenue_breakdown() -> dict[str, Any]:
    """Per-game revenue from completed purchases (same shape as legacy Node)."""
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      p."gameId" AS game_id,
                      g.title AS game_title,
                      SUM(p."amount")::double precision AS revenue,
                      COUNT(*)::int AS purchases
                    FROM purchases p
                    JOIN games g ON g.id = p."gameId"
                    WHERE p."status" = 'completed'
                    GROUP BY p."gameId", g.title
                    ORDER BY revenue DESC
                    """
                )
                rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Revenue breakdown failed: {exc}") from exc

    by_game = [
        {
            "gameId": r["game_id"],
            "gameTitle": r["game_title"],
            "revenue": _fnum(r["revenue"]),
            "purchases": _int(r["purchases"]),
        }
        for r in rows
    ]
    total = sum(x["revenue"] for x in by_game)
    return {"source": "python-service", "byGame": by_game, "total": total}
