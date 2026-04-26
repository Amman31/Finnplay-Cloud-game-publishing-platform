"""Normalize Prisma-style PostgreSQL URLs for libpq/psycopg."""

from __future__ import annotations

import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def postgresql_url_for_psycopg(url: str) -> str:
    """Remove Prisma-only URI parameters (e.g. ``schema=``) that libpq rejects."""
    parsed = urlparse(url)
    if not parsed.query:
        return url
    kept = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() != "schema"]
    new_query = urlencode(kept) if kept else ""
    return urlunparse(parsed._replace(query=new_query))


def require_postgresql_url() -> str:
    raw = os.getenv("POSTGRESQL_URL")
    if not raw:
        raise RuntimeError("POSTGRESQL_URL is required for python-service")
    return postgresql_url_for_psycopg(raw)
