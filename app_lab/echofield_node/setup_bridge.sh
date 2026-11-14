#!/bin/sh
# Bring App Lab's Python libraries out of its docker image, so main.py can run
# over SSH with the board's own python3. Run once per board:
#
#   ./setup_bridge.sh
#
# Why it works: the Bridge is not inside the container. arduino-router runs on
# the board itself and listens on /run/arduino-router.sock; the container only
# mounts that socket. What the board lacks is the Python side of it,
# arduino.app_utils, which App Lab ships inside its image together with its
# dependencies, and there is no pip on the board to install them.
#
# So this copies the image's whole site-packages (docker's merged view, so a
# dependency living in another layer is not left behind) into ~/gaia/.bridge,
# checks that the system python can import the Bridge from there, and checks
# that this user may open the router socket. It needs sudo, because docker and
# /var/lib/docker belong to root, and it writes nothing outside .bridge/.
# run_board.sh picks the copy up by itself.

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
DEST="$ROOT/.bridge"
if [ ! -f "$ROOT/aggregate/node.py" ]; then
    echo "run this from inside the gaia repository (no aggregate/node.py under $ROOT)"
    exit 1
fi
PYVER=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')

echo "== 1. where App Lab keeps arduino.app_utils =="
FOUND=$(sudo find /var/lib/docker/overlay2 -type d -path '*/site-packages/arduino/app_utils' 2>/dev/null | head -1)
if [ -z "$FOUND" ]; then
    echo "   not found: is App Lab installed here, and has an app run on this board at least once?"
    exit 1
fi
LAYER=$(echo "$FOUND" | sed 's#^/var/lib/docker/overlay2/\([^/]*\)/.*#\1#')
SITE=$(echo "$FOUND" | sed 's#^.*/diff\(/.*/site-packages\)/arduino/app_utils$#\1#')
IMGPY=$(echo "$SITE" | sed -n 's#.*/python\([0-9]*\.[0-9]*\)/site-packages$#\1#p')
echo "   $FOUND"
echo "   site-packages at $SITE, python $IMGPY in the image, $PYVER on this board"
if [ "$IMGPY" != "$PYVER" ]; then
    echo "   WARNING: different python versions, compiled modules may refuse to load"
fi

echo "== 2. the image that holds it =="
IMAGE=""
for img in $(sudo docker images -q | sort -u); do
    if sudo docker image inspect "$img" \
        --format '{{.GraphDriver.Data.LowerDir}}:{{.GraphDriver.Data.UpperDir}}' \
        | grep -q "$LAYER"; then
        IMAGE=$img
        break
    fi
done
if [ -z "$IMAGE" ]; then
    echo "   no docker image contains layer $LAYER"
    exit 1
fi
echo "   $IMAGE ($(sudo docker image inspect "$IMAGE" --format '{{join .RepoTags ","}}'))"

echo "== 3. copy its site-packages =="
CID=$(sudo docker create "$IMAGE" true) || { echo "   docker create failed"; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
if ! sudo docker cp "$CID:$SITE" "$DEST/site-packages"; then
    sudo docker rm "$CID" >/dev/null
    echo "   docker cp failed"
    exit 1
fi
sudo docker rm "$CID" >/dev/null
sudo chown -R "$(id -u):$(id -g)" "$DEST"
echo "   $(du -sh "$DEST/site-packages" | cut -f1) copied to $DEST/site-packages"

echo "== 4. can the board's python import the Bridge now? =="
if PYTHONPATH="$DEST/site-packages" python3 -c "from arduino.app_utils import App, Bridge"; then
    echo "   bridge ok"
else
    echo "   still failing: the error above is what to send"
    exit 1
fi

echo "== 5. may $(id -un) open the router socket? =="
ls -la /run/arduino-router.sock 2>/dev/null || echo "   /run/arduino-router.sock is missing: is arduino-router.service running?"
if id -nG | tr ' ' '\n' | grep -qx arduino-router; then
    echo "   yes, $(id -un) is in the arduino-router group"
else
    echo "   NO: $(id -un) is not in the arduino-router group, so every Bridge call"
    echo "   will fail with 'permission denied'. Fix it once, then log out and in again:"
    echo "       sudo usermod -aG arduino-router $(id -un)"
fi

echo "done: run_board.sh uses $DEST by itself."
