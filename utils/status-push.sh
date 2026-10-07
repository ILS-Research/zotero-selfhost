#!/bin/sh
# Push monitor for Uptime Kuma (or any service with a push URL): checks the stack through its public URLs, like the
# clients reach it, and calls the push URL only when a check passes. The monitor in Kuma (type "Push") goes down when
# the pushes stop. Runs as the optional compose service "status-push" (profile status-push), see README.
#
#   STATUS_PUSH_STREAM_URL   push URL for the streaming server: WebSocket handshake on STREAMING_URL answers 101
#   STATUS_PUSH_API_URL      optional, push URL for the API: GET <ZOTERO_API_URL>/schema answers 200
#   STATUS_PUSH_PORTAL_URL   optional, push URL for the portal: GET <WEB_LIBRARY_URL>/downloads (public) answers 200
#   STATUS_PUSH_INTERVAL     seconds between checks (default 300; keep it well below the monitor's heartbeat interval)
# Push URLs as Kuma shows them (…/api/push/<token>?status=up&msg=OK&ping=); the script fills in msg and ping.
set -u
INTERVAL=${STATUS_PUSH_INTERVAL:-300}

# Extra trusted CAs (data/ca-certificates/*.crt, like the portal) on top of the system bundle
CA=/tmp/ca.pem
cat /etc/ssl/certs/ca-certificates.crt > "$CA"
for c in /certs/*.crt; do [ -f "$c" ] && cat "$c" >> "$CA"; done

# push <push URL> <message> <ms>: only the part before "?" is kept, then status=up&msg=…&ping=…
push() {
  [ -n "$1" ] || return 0
  base=${1%%\?*}
  answer=$(curl -s --max-time 15 --cacert "$CA" "$base?status=up&msg=$(printf %s "$2" | sed 's/ /%20/g')&ping=$3")
  # Kuma answers {"ok":true}; anything else (wrong token, monitor paused, not reachable) is logged
  case "$answer" in
    *'"ok":true'*) [ -n "${STATUS_PUSH_VERBOSE:-}" ] && echo "status-push: pushed $2 (${3} ms)" ;;
    *) echo "status-push: push to ${base%/*}/… not accepted: ${answer:-no answer}" ;;
  esac
}

# check <name> <push URL> <expected code> <curl args…>
check() {
  name=$1; url=$2; want=$3; shift 3
  [ -n "$url" ] || return 0
  # Status code and duration as curl measures them (busybox date has no nanoseconds)
  set -- $(curl -s -o /dev/null -w '%{http_code} %{time_starttransfer}' --max-time 15 --cacert "$CA" "$@")
  code=$1
  ms=$(awk -v t="${2:-0}" 'BEGIN { printf "%d", t * 1000 }')
  if [ "$code" = "$want" ]; then
    push "$url" "OK" "$ms"
  else
    echo "status-push: $name answered $code (expected $want), no push"
  fi
}

stream_https=$(printf %s "${STREAMING_URL:-}" | sed 's#^wss://#https://#; s#^ws://#http://#')
api=${ZOTERO_API_URL%/}
portal=${WEB_LIBRARY_URL%/}
echo "status-push: every ${INTERVAL}s – stream ${stream_https:-–}${STATUS_PUSH_API_URL:+, api $api}${STATUS_PUSH_PORTAL_URL:+, portal $portal}"

while :; do
  # After the 101 the WebSocket stays open: --max-time 3 ends it, the handshake time is measured to the first byte
  [ -n "$stream_https" ] && check stream "${STATUS_PUSH_STREAM_URL:-}" 101 --max-time 3 --http1.1 \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "$stream_https"
  check api "${STATUS_PUSH_API_URL:-}" 200 -H 'Zotero-API-Version: 3' "$api/schema"
  check portal "${STATUS_PUSH_PORTAL_URL:-}" 200 "$portal/downloads"
  sleep "$INTERVAL"
done
