# Deployment

Three ways to run this, and they are not variations of one thing.

| | command | what it is |
|---|---|---|
| **dev** | `npm run dev` | Vite dev server with HMR. Not meant to face a network. |
| **one-off** | `npm run build && npm start` | The built client from `dist/`, served by Node. Dies with the shell. |
| **service** | see below | Survives logout and reboot, restarts on failure. |

Environment variables are in the [README](../README.md#environment). Two of them
decide how exposed this is and are worth repeating: `HOST` defaults to
`127.0.0.1` because **this process authenticates nothing**, and
`ALLOW_SERVER_MODEL_CALLS` turns on the three endpoints that run models on API
keys held by the server with no authentication of their own —
`/api/relay/adjudicate`, `/api/relay/step-triad` and `/api/relay/agent-exec`.

Until this was fixed the flag was named `ALLOW_AGENT_EXEC` and gated only the
last of the three. The other two were reachable with it unset, so on a
deployment whose reverse proxy asked for a password, that password was the only
thing standing between the open internet and the server's model spend — a lock
on the wallet that read as a lock on the data, and would have been removed with
it. The old name still works.

## Behind a reverse proxy

There is no authentication in this application. Every route is reachable by
whoever reaches the socket, including `POST /api/relay/reset`. A public
deployment needs something in front that authenticates, and the binding is the
second barrier rather than the only one.

```
relay.example.org {
    basic_auth {
        <user> <bcrypt hash from `caddy hash-password`>
    }
    reverse_proxy 127.0.0.1:3000
}
```

### If the proxy runs in a container

`127.0.0.1` is then the wrong binding and the symptom is a 502 with nothing in
the application log — the proxy never reached it.

A container reaching the host through `host.docker.internal` arrives at the
docker bridge, typically `172.17.0.1`, so that is what `HOST` must be. It is
still not a public interface.

Two details that cost an hour here:

- **The container may not be on `docker0`.** Compose creates its own bridge, so
  traffic *leaves* through `br-<id>` while `host.docker.internal` still resolves
  to `172.17.0.1`. A firewall rule scoped to `docker0` will not match it. Scope
  by source instead — `ufw allow from 172.18.0.0/16 to any port <port> proto
  tcp` — which also survives the bridge being recreated under a new name.
- **Check which process holds the port**, not just that something answers.
  A stray run from an earlier shell will serve `200` while the service beside it
  fails with `Is port <port> in use?`. Compare `systemctl --user show <unit>
  --property=MainPID` against `ss -tlnp`.

## As a service

`deploy/relay-ui.service.example` is a user unit — no root needed. Copy it to
`~/.config/systemd/user/`, replace the placeholders, then:

```sh
loginctl enable-linger "$USER"      # so it survives logout and starts at boot
systemctl --user daemon-reload
systemctl --user enable --now relay-ui
```

The unit runs `bun dist/server.cjs` rather than `node` deliberately: an nvm path
carries a version (`~/.nvm/versions/node/v22.19.0/bin/node`) and breaks on the
next upgrade, while `~/.bun/bin/bun` is stable and runs the CJS bundle. Either
works; only one of them keeps working.

## Updating

**`Restart=` does not know the code changed.** It restarts a process that died;
after a `git pull` the running one keeps serving the bundle it started with.
Updating is an explicit step, and `./deploy.sh` is it:

```
git pull → install → typecheck → build → store checks → restart → verify
```

`set -euo pipefail`, so a failing build never reaches the restart.

Paths differ per host, so the script reads them from `deploy.env` beside it —
untracked, because a committed file holding one host's paths is a file every
other host has to remember not to use. `APP_DIR`, `UNIT`, `PE_STORE_ROOT`,
`HEALTH_URL`; the script's header carries a block to copy.

Check `HEALTH_URL` against the unit rather than assuming `127.0.0.1`. A service
with `HOST` set to something else does not answer there, and the health check
would fail on a deployment that is working.

This used to be `deploy/deploy.sh.example`, a template to copy. On at least one
host nobody copied it, so updating meant reassembling the command from memory —
and the step that exists because `Restart=` cannot notice new code is a poor one
to reconstruct by hand.

A systemd `.path` unit watching `dist/` would restart automatically and is
deliberately not used: a build writes many files over several seconds, so the
watcher fires midway and restarts the service against a half-written tree.
Restarting once, last, after the build succeeded is the property that matters.

## Reading an existing p-e store

`PE_STORE_ROOT` points this at a p-e relay store instead of its own. That
backend is read-only — `write`, `delete` and `reset` are declared unavailable in
`capabilities` and refused with `405` — so the corpus cannot be modified through
the UI no matter what a request asks for. `npm run check:pe-store` verifies
that, ending with an assertion that the store holds as many records after the
run as before.

Agents that need to *write* to such a store do so through its own guarded path,
and this view shows the result.
