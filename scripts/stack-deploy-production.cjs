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

function hostOnlyFromEnv(name) {
    let v = String(process.env[name] || '').trim();
    if (/\/|:\/\//.test(v)) {
        console.error(
            `Deploy aborted: ${name} must be a hostname only (e.g. finnplay.xyz or api.finnplay.xyz), not a URL. Remove https:// and any path.`
        );
        process.exit(1);
    }
    return v.toLowerCase();
}

const appHost = hostOnlyFromEnv('APP_HOST');
const apiHost = hostOnlyFromEnv('API_HOST');
if (!appHost || !apiHost) {
    console.error('Deploy aborted: APP_HOST and API_HOST must be set (hostname only, no https://).');
    process.exit(1);
}
if (appHost === apiHost) {
    console.error(
        'Deploy aborted: APP_HOST and API_HOST must be different hostnames.\n' +
            'Traefik routes the web UI and the API with separate Host() rules. If both are the same (e.g. finnplay.xyz),\n' +
            "TLS and routing break (browser sees ERR_CERT_AUTHORITY_INVALID / wrong certificate).\n" +
            'Use an apex or subdomain for the app (e.g. APP_HOST=finnplay.xyz) and keep the API on another host (e.g. API_HOST=api.finnplay.xyz).'
    );
    process.exit(1);
}

// Let's Encrypt rejects invalid / empty contacts; Traefik then falls back to "TRAEFIK DEFAULT CERT" (browser: ERR_CERT_AUTHORITY_INVALID).
const acmeEmail = String(process.env.TRAEFIK_ACME_EMAIL || '').trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(acmeEmail)) {
    console.error(
        "Deploy aborted: TRAEFIK_ACME_EMAIL must be a real mailbox Let's Encrypt can use (e.g. you@gmail.com).\n" +
            'No spaces, no angle brackets, no `mailto:`. Fix it in /opt/finnplay/.env then redeploy.\n' +
            'If Traefik logs showed invalidContact / unable to parse email address, this was the cause.'
    );
    process.exit(1);
}

const composeFile = path.join('infra', 'swarm', 'stack.yml');
const result = spawnSync('docker', ['stack', 'deploy', '-c', composeFile, 'finnplay'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false
});

process.exit(result.status === null ? 1 : result.status);
