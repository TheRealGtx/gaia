# Gemma: the situation report (Chuqi)

Gemma 3 1B turns the state of the field into one or two sentences a person can
read: "Fire risk near Office A; Reception and Meeting Room agree; move towards
the Meeting Room." It never decides anything. `dist`, `alert` and `escape_to`
come from the nodes; Gemma only rephrases them.

```
gateway (:8000)  --snapshot-->  report.py (laptop)  --prompt-->  Ollama + Gemma (on the boards)
                                     |
                                     +--ai-summary-->  dashboard
```

- When the field changes, a **template sentence** goes to the dashboard at once
  (`Template: ...`). About 20-25 s later Gemma's version replaces it
  (`Gemma: ...`). If no board answers, the template stays: the demo never
  depends on Gemma.
- Gemma runs on **all three boards**. `report.py` uses the first one that
  answers a 2 s ping, in the order given; if that board goes down it moves to
  the next (log: `Gemma now answering from ...`).
- Measured on Node2: prompt 7.7 tok/s, generation 6.3 tok/s, about 24 s per
  report.

## Install on a board (once)

The board needs internet for the download (about 800 MB).

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma3:1b
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_CONTEXT_LENGTH=1024"\nNice=15\nCPUWeight=20\n' | sudo tee /etc/systemd/system/ollama.service.d/lan.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

`lan.conf` makes Ollama listen on the network, so the laptop can reach it,
keeps its context small (the board has 1.7 GB of RAM), and puts it below the
node and the sensor app in priority. It restarts by itself after a reboot.

**Free the 1.9 GB Ollama does not need.** The ARM installer ships NVIDIA CUDA
libraries meant for Jetson boards. The UNO Q has no NVIDIA GPU, so they are
never loaded, and on Node3 they filled the disk:

```bash
sudo rm -rf /usr/local/lib/ollama/cuda_v12 /usr/local/lib/ollama/cuda_v13; df -h /
```

(An Ollama update puts them back.)

**Check on the board:**

```bash
ollama run gemma3:1b --verbose "Say hi in one sentence"
```

It answers in a few seconds with an `eval rate` around 6 tokens/s.

Pitfalls already hit:

- Do **not** stop the service and run `ollama serve` by hand: that instance
  looks for models in another folder and finds none (`total blobs: 0`).
- `Connection refused` from the laptop means the service is stopped:
  `sudo systemctl restart ollama`.

## Run it (on the laptop, not on a board)

`report.py` talks to the gateway on `localhost:8000`, so it runs where the
gateway runs. On a board it fails with `Connection refused`. Start it after
the gateway, in its own terminal, from the repository folder. It needs only
`websockets`, which the gateway's environment already has.

Windows (PowerShell):

```powershell
$env:OLLAMA = "http://192.168.137.182:11434,http://192.168.137.180:11434,http://192.168.137.25:11434"
dashboard\.venv\Scripts\python.exe gemma\report.py
```

Linux or macOS:

```bash
OLLAMA=http://192.168.137.182:11434,http://192.168.137.180:11434,http://192.168.137.25:11434 dashboard/.venv/bin/python gemma/report.py
```

**Order: the end boards first, the middle one last.** The board that writes a
sentence works hard for about 24 s. If the middle board fell behind long enough
to drop out of the mesh, the line would split in two; an end board dropping
splits nothing. On GaiaMesh the addresses become `10.77.0.3`, `10.77.0.1`,
`10.77.0.2`.

At start it wakes Gemma on every board and logs `Gemma ready at ...` or
`Gemma not available at ...` for each.

| Variable | Default | Meaning |
| --- | --- | --- |
| `OLLAMA` | `http://localhost:11434` | Gemma hosts, comma separated, in order of preference |
| `GATEWAY` | `http://localhost:8000` | the gateway |
| `GEMMA_TIMEOUT` | `120` | seconds to wait for one answer |
| `EVERY` | `10` | minimum seconds between reports |
| `NO_GEMMA=1` | off | template only |

## Sharing a board with the mesh

Generation uses every core for tens of seconds and keeps about 1 GB in memory
for two hours (`keep_alive`). `install_service.sh` gives the node and the sensor
app priority over everything else on the board and protects them from the
out-of-memory killer, and `lan.conf` above puts Ollama below them. To be sure,
watch the node on a board next to the one answering:

```bash
journalctl -u gaia-node -f -o cat
```

and make the field change. The `age=` of the Gemma board in that status line
must stay under about 2 s while Gemma writes; towards 4 s it is being starved
and would be dropped by its neighbours.

## Quick test without the gateway

On any board with Gemma, from `~/gaia`:

```bash
PYTHONPATH=$PWD/.bridge/site-packages python3 -c "
import sys; sys.path.insert(0, 'gemma'); import report as r
n = [dict(id='A-01', physicalId=1, name='Reception', gradientDistance=1, temperature=25.1, status='normal'),
     dict(id='A-02', physicalId=2, name='Office A', gradientDistance=0, temperature=38.4, status='critical'),
     dict(id='A-03', physicalId=3, name='Meeting Room', gradientDistance=1, temperature=25.3, status='normal')]
t = r.template(n); print('Template:', t); print('Gemma:', r.gemma(n, t))"
```

## In the demo

Pull the power of the board that is answering: reports keep coming and the log
shows `Gemma now answering from ...`. Like the mesh, Gemma has no single point
of failure.
