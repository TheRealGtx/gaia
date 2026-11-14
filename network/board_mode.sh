#!/bin/sh
# Switch this board's Wi-Fi between the laptop's hotspot and GaiaMesh, the
# ad-hoc (IBSS) network where boards and laptop are peers and there is no
# access point at all.
#
#   sudo ./board_mode.sh adhoc --test 30   # try it: back to the hotspot in 30 min
#   sudo ./board_mode.sh adhoc             # for good: also after a power cycle
#   sudo ./board_mode.sh hotspot           # back to the laptop's hotspot
#   ./board_mode.sh status                 # where this board is now
#
# Board N is 10.77.0.N (N = NODE_ID from /etc/gaia/board.env), the laptop is
# 10.77.0.100. There is no DHCP in ad-hoc, so the addresses are fixed.
#
# Read this before the first switch: in ad-hoc a board cannot be reached from
# the laptop booted in Windows, because its Wi-Fi driver cannot join IBSS.
# That is why the first switch is always --test: if anything goes wrong, do
# nothing and the board comes back to the hotspot by itself. Once a board is in
# ad-hoc for good, take it back with `hotspot` FROM the Linux laptop
# (ssh arduino@10.77.0.N) before booting Windows again.
#
# node.py needs nothing: it re-reads its interfaces every 10 s, so its log just
# says "network changed: now sending to ... 10.77.0.255".

set -eu
SSID=GaiaMesh
CHANNEL=6
CON=gaia-adhoc
CONF=/etc/gaia/board.env
STATE=/etc/gaia/hotspot-profile      # name of the hotspot profile, to go back to

die() { echo "$*" >&2; exit 1; }

IFACE=$(nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}')
[ -n "$IFACE" ] || die "no Wi-Fi interface found"
CUR=$(nmcli -t -f NAME,DEVICE con show --active | awk -F: -v i="$IFACE" '$2==i{print $1}')

case "${1:-status}" in
status)
    echo "Wi-Fi $IFACE on: ${CUR:-nothing}"
    ip -4 -o addr show "$IFACE" | awk '{print "address:", $4}'
    systemctl list-timers 'gaia-revert-*' --no-pager 2>/dev/null | grep gaia-revert \
        && echo "(a return to the hotspot is scheduled: this is a test)" || true
    exit 0
    ;;
adhoc)
    [ "$(id -u)" -eq 0 ] || die "run it with sudo"
    [ -r "$CONF" ] || die "no $CONF: run install_service.sh first, it holds NODE_ID"
    . "$CONF"
    [ -n "${NODE_ID:-}" ] || die "no NODE_ID in $CONF"
    TEST_MIN=""
    if [ "${2:-}" = "--test" ]; then
        TEST_MIN=${3:?usage: board_mode.sh adhoc --test MINUTES}
    fi

    # Remember the hotspot profile while we are still on it: it is the way back.
    if [ -n "$CUR" ] && [ "$CUR" != "$CON" ]; then
        printf '%s\n' "$CUR" > "$STATE"
    fi
    HOT=$(cat "$STATE" 2>/dev/null || true)
    [ -n "$HOT" ] || die "do not know which hotspot profile to go back to: run this while on the hotspot"

    if [ "$CUR" = "$CON" ] && [ -z "$TEST_MIN" ]; then
        # Already on GaiaMesh (a test, typically): make it permanent in place,
        # without dropping the SSH session this is probably running in.
        systemctl stop 'gaia-revert-*.timer' 2>/dev/null || true
        nmcli con modify "$CON" connection.autoconnect yes connection.autoconnect-priority 10
        nmcli con modify "$HOT" connection.autoconnect no
        echo "board $NODE_ID stays on $SSID for good (10.77.0.$NODE_ID), also after a power cycle."
        exit 0
    fi

    nmcli con delete "$CON" >/dev/null 2>&1 || true
    nmcli con add type wifi ifname "$IFACE" con-name "$CON" ssid "$SSID" \
        802-11-wireless.mode adhoc 802-11-wireless.band bg \
        802-11-wireless.channel "$CHANNEL" \
        ipv4.method manual ipv4.addresses "10.77.0.$NODE_ID/24" \
        ipv6.method disabled connection.autoconnect no >/dev/null

    if [ -n "$TEST_MIN" ]; then
        # The way back is armed BEFORE leaving, and counts from now.
        systemd-run --on-active="${TEST_MIN}m" --unit="gaia-revert-$(date +%s)" \
            nmcli con up "$HOT" >/dev/null
        echo "test: board $NODE_ID goes to $SSID as 10.77.0.$NODE_ID and comes back to"
        echo "'$HOT' by itself in $TEST_MIN minutes. To keep it: from the Linux laptop,"
        echo "  ssh arduino@10.77.0.$NODE_ID 'cd gaia && sudo ./network/board_mode.sh adhoc'"
    else
        systemctl stop 'gaia-revert-*.timer' 2>/dev/null || true
        nmcli con modify "$CON" connection.autoconnect yes connection.autoconnect-priority 10
        nmcli con modify "$HOT" connection.autoconnect no
        echo "board $NODE_ID goes to $SSID for good as 10.77.0.$NODE_ID."
    fi
    echo "this SSH session will drop now."
    nmcli con up "$CON"
    ;;
hotspot)
    [ "$(id -u)" -eq 0 ] || die "run it with sudo"
    HOT=$(cat "$STATE" 2>/dev/null || true)
    [ -n "$HOT" ] || die "no $STATE: this board was never switched by this script"
    systemctl stop 'gaia-revert-*.timer' 2>/dev/null || true
    nmcli con modify "$HOT" connection.autoconnect yes
    nmcli con modify "$CON" connection.autoconnect no 2>/dev/null || true
    echo "back to '$HOT'. If the laptop is in Linux that hotspot does not exist yet:"
    echo "the board joins it by itself as soon as Windows brings it up."
    echo "this SSH session will drop now."
    nmcli con down "$CON" 2>/dev/null || true
    nmcli con up "$HOT" 2>/dev/null || true
    ;;
*)
    die "usage: board_mode.sh status | adhoc [--test MINUTES] | hotspot"
    ;;
esac
