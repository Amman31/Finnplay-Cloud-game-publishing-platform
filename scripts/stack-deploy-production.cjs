/**
 * Loads repo-root `.env` into process.env and runs `docker stack deploy` for stack.yml (HTTPS / production).
 * Same pattern as stack-deploy-local.cjs — use when `docker stack deploy --env-file` is unavailable.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        // Shell / CI (e.g. GitHub Actions) exports must win over repo .env so IMAGE_TAG / REGISTRY_PREFIX from CD are not overwritten by a stale .env on the manager.
        if (process.env[key] !== undefined && String(process.env[key]).trim() !== '') {
            continue;
        }
        let val = trimmed.slice(eq + 1).trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        process.env[key] = val;
    }
}

// GHCR image paths must be lowercase; normalize if .env was applied before exports or mixed-case slipped in.
const rp = process.env.REGISTRY_PREFIX;
if (rp && /^ghcr\.io\//i.test(rp)) {
    process.env.REGISTRY_PREFIX = 'ghcr.io/' + rp.replace(/^ghcr\.io\//i, '').toLowerCase();
}

const composeFile = path.join('infra', 'swarm', 'stack.yml');
const result = spawnSync('docker', ['stack', 'deploy', '-c', composeFile, 'finnplay'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false
});

process.exit(result.status === null ? 1 : result.status);
