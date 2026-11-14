// Gaia node: MCU side (one sketch per board, shared by sensing + LEDs).
//
// Exposes to the Linux/Python side through the App Lab Bridge:
//   read_temp()             -> float, degrees C   (Modulino Thermo)
//   read_hum()              -> float, % RH        (Modulino Thermo)
//   set_pixels(r, g, b)     -> board RGB LEDs (LED3+LED4), and Modulino Pixels if plugged in
//
// UNVERIFIED (check against App Lab's own Modulino / Bridge examples):
//   [B1] library name <Arduino_RouterBridge.h> and Bridge.begin()
//   [B2] Bridge.provide(name, fn) with return values and int arguments.
//        Some examples use Bridge.provide_safe(...) so the call runs in
//        loop() context; if I2C reads hang or crash, switch to provide_safe.
//   [M1] ModulinoPixels::set(index, ModulinoColor, brightness) signature
//   [X1] LED matrix API: <Arduino_LED_Matrix.h>, matrix.begin(),
//        matrix.draw(uint8_t[104]) with 0 = off, 1 = on, 8 rows x 13 columns,
//        row by row. Compare with App Lab's LED matrix example if it fails.
//
//   show_state(dist, dir)   -> LED matrix: moving arrow toward the escape
//                              (dir -1 left / +1 right), border flashing on
//                              the hazard itself, small dot when all is
//                              quiet, "X" when node.py is not answering

#include <Arduino_RouterBridge.h>   // [B1]
#include <Modulino.h>
#include <Arduino_LED_Matrix.h>     // [X1]

ModulinoThermo thermo;
ModulinoPixels pixels;
bool hasPixels = false;

float readTemp() {
  return thermo.getTemperature();
}

float readHum() {
  return thermo.getHumidity();
}

// The UNO Q's own RGB LEDs (LED3 and LED4, next to the "STM 3 4" labels),
// driven by the MCU. Active LOW: LOW = on. Each channel is on/off only, so the
// colours main.py asks for map to: red, yellow (red+green = "amber"), green,
// blue, white (all three = "node not answering").
// [L1] UNVERIFIED pin names LED3_R/G/B, LED4_R/G/B: if the sketch does not
//      compile, check the UNO Q pinout in App Lab's Blink example.
const int RGB_PINS[6] = {LED3_R, LED3_G, LED3_B, LED4_R, LED4_G, LED4_B};

void setOnboard(int r, int g, int b) {
  int on[3] = {r > 0, g > 0, b > 0};
  for (int led = 0; led < 2; led++) {
    for (int c = 0; c < 3; c++) {
      digitalWrite(RGB_PINS[led * 3 + c], on[c] ? LOW : HIGH);
    }
  }
}

void setPixels(int r, int g, int b) {
  setOnboard(r, g, b);               // always: the board's own RGB LEDs
  if (!hasPixels) return;            // no Modulino Pixels plugged in: done
  for (int i = 0; i < 8; i++) {
    pixels.set(i, ModulinoColor(r, g, b), 25);   // [M1] brightness 0-100
  }
  pixels.show();
}

// ---- LED matrix (8 rows x 13 columns, single colour) ----------------------
// Shows where to run: an arrow moving toward the safest neighbour (escape_to,
// computed by node.py). Boards stand in a line 1-2-3 from left to right, so
// "escape to a higher id" = arrow to the right (main.py does that mapping).
Arduino_LED_Matrix matrix;           // [X1]
const int ROWS = 8, COLS = 13;
uint8_t frame[ROWS * COLS];
volatile int shownDist = 99;         // set by show_state(), drawn by loop()
volatile int shownDir = 0;           // -1 = run left, +1 = run right, 0 = no arrow

void clearFrame() {
  for (int i = 0; i < ROWS * COLS; i++) frame[i] = 0;
}

void setDot(int r, int c) {
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) frame[r * COLS + c] = 1;
}

// A chevron ">" whose tip is at column x (rows 0..7); mirrored for "<".
void chevron(int x, int dir) {
  for (int r = 0; r < ROWS; r++) {
    int k = (r < 4) ? r : 7 - r;     // 0,1,2,3,3,2,1,0
    int c = (dir > 0) ? x - 3 + k : x + 3 - k;
    setDot(r, c);
    setDot(r, c - dir);              // two pixels thick
  }
}

void drawFrame(int tick) {
  clearFrame();
  int d = shownDist, dir = shownDir;
  if (d < 0) {                       // node.py not answering: X
    for (int i = 0; i < ROWS; i++) { setDot(i, 2 + i); setDot(i, 10 - i); }
  } else if (dir != 0) {             // a hazard is known: run this way
    int shift = tick % 6;            // chevrons march across the matrix
    for (int x = -6; x < COLS + 6; x += 6) {
      chevron(dir > 0 ? x + shift : x - shift, dir);
    }
    if (d == 0 && (tick % 4) < 2) {  // I am the hazard: frame flashes too
      for (int c = 0; c < COLS; c++) { setDot(0, c); setDot(ROWS - 1, c); }
    }
  } else if (d == 0) {               // hazard here, nowhere safer to go: blink
    if (tick % 2) for (int i = 0; i < ROWS * COLS; i++) frame[i] = 1;
  } else {                           // no hazard known: a slow heartbeat
    // Two static pixels read as "off" from a metre away and on camera, which
    // is how a working board looked broken. A 2x3 block blinking at ~0.8 Hz
    // says "alive, all clear" (tick is 150 ms: 4 ticks on, 4 off).
    if ((tick / 4) % 2 == 0) {
      for (int r = 3; r <= 4; r++) for (int c = 5; c <= 7; c++) setDot(r, c);
    }
  }
  matrix.draw(frame);                // [X1]
}

void showState(int d, int dir) {
  shownDist = d;
  shownDir = (dir > 0) ? 1 : (dir < 0 ? -1 : 0);
}

void setup() {
  for (int i = 0; i < 6; i++) {
    pinMode(RGB_PINS[i], OUTPUT);
    digitalWrite(RGB_PINS[i], HIGH); // off
  }
  Bridge.begin();                    // [B1]
  Modulino.begin();
  thermo.begin();
  hasPixels = pixels.begin();        // false if no Pixels module is plugged in

  Bridge.provide("read_temp", readTemp);    // [B2]
  Bridge.provide("read_hum", readHum);      // [B2]
  Bridge.provide("set_pixels", setPixels);  // [B2]
  Bridge.provide("show_state", showState);  // [B2]
  matrix.begin();                           // [X1]

  setPixels(0, 0, 40);               // blue = "sketch is alive"
}

void loop() {
  // Bridge callbacks only store the state; drawing happens here, which also
  // animates the arrow without any timer.
  static unsigned long last = 0;
  static int tick = 0;
  if (millis() - last >= 150) {
    last = millis();
    drawFrame(tick++);
  }
  delay(10);
}
