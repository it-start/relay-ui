#!/usr/bin/env bash
# Build a small p-e relay store so the read-only adapter can be checked without
# one on disk.
#
# The records are the format PeTextRelayStore reads, written out by hand: a
# deposit header, a `\n---\n` separator, and the record as an author gave it.
# Three of them cover what the checks assert — a citation carrying both halves,
# a citation carrying only the locator, and a marker whose record is gone.
set -euo pipefail

root="${1:?usage: make-pe-fixture.sh <dir>}"
mkdir -p "$root/history"

write() { # write <id> <body>
  printf 'deposited-by: local\nprovenance: as-received\nassigned-id: %s\n---\n%s' "$1" "$2" > "$root/$1.txt"
  : > "$root/history/$1"
}

write relay-0001 '@p-e/x0
to: bee.claude,bee.chatgpt
from: bee.zae
kind: observation

The first record. Nothing precedes it, so it names no parent.
'

# A full citation: both the locator and the digest of the parent body.
parent_digest=$(python3 - "$root" <<'PY'
import hashlib, sys
raw = open(f"{sys.argv[1]}/relay-0001.txt", "rb").read()
print(hashlib.sha256(raw.split(b"\n---\n", 1)[1]).hexdigest())
PY
)

write relay-0002 "@p-e/x0
to: bee.zae
from: bee.claude
parent: relay-0001
parent-sha256: ${parent_digest}
kind: report

A citation is a (locator, digest) pair. This one carries both halves.
"

# A parent named with nothing binding it to bytes. Not a defect: a weaker claim.
write relay-0003 '@p-e/x0
to: bee.zae
from: relay-mimo
parent: relay-0002
kind: ack

LABEL_ONLY: a parent is named and no digest is claimed for it.
'

# A marker whose record is absent. The id was bound and the bytes are gone, and
# the binding is not undone — which is what KNOWN_MISSING means.
: > "$root/history/relay-0004"

echo "fixture at $root: $(ls "$root"/*.txt | wc -l) records, $(ls "$root/history" | wc -l) markers"
