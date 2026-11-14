# Gemma on a board without hurting the mesh

Next to Chuqi's install instructions, not instead of them. `report.py` runs on
the laptop and asks Ollama for a sentence; Ollama can run on a board. The
risk: `report.py` asks Ollama to keep Gemma loaded for two hours
(`keep_alive: "2h"`, so about 1 GB of RAM stays taken) and generation uses
every core for tens of seconds. If the board runs short of memory everything
stalls for seconds, the heartbeat misses its 4 s window, and the neighbours
drop the board, during a fire, which is exactly when Gemma is asked to talk.

## Before installing

1. **Memory.** On the board:

   ```bash
   free -h
   ```

   If `available` is under about 1.5 GB, run Gemma on the laptop instead.

2. **One board, at an end of the line** (1 or 3), never the middle one: if it
   struggles and drops out, a middle board splits the line in two.

3. **Re-run the service installer on every board**, it now gives the node and
   the sensor app priority over anything else running there:

   ```bash
   cd ~/gaia && git pull && cd app_lab/echofield_node && sudo ./install_service.sh N NEIGHBORS
   ```

## After installing Ollama

4. **Let the laptop reach it, and keep it below the mesh:**

   ```bash
   sudo mkdir -p /etc/systemd/system/ollama.service.d
   printf '[Service]\nEnvironment=OLLAMA_HOST=0.0.0.0:11434\nNice=15\nCPUWeight=20\n' | sudo tee /etc/systemd/system/ollama.service.d/gaia.conf
   sudo systemctl daemon-reload && sudo systemctl restart ollama
   ```

5. **Pull the model now**, while the board has internet. On GaiaMesh it will
   not:

   ```bash
   ollama pull gemma3:1b
   ```

6. **The test that decides.** On a board *next to* the Gemma board, watch the
   node:

   ```bash
   journalctl -u gaia-node -f -o cat
   ```

   then make the field change (heat a board) so `report.py` asks Gemma. In the
   status line, the `age=` of the Gemma board must stay under about 2 s while
   Gemma writes. If it climbs towards 4 s, that board is being starved: move
   Gemma to the laptop.

7. **Board first, laptop as fallback**, in `report.py`:

   ```bash
   OLLAMA=http://192.168.137.182:11434,http://localhost:11434 python3 gemma/report.py
   ```

   On GaiaMesh the board's address becomes `10.77.0.N`: change it there too.
