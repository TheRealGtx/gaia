// Gaia node: MCU side (one sketch per board, shared by sensing + LEDs).
//
// Exposes to the Linux/Python side through the App Lab Bridge:
//   read_temp()             -> float, degrees C   (Modulino Thermo)
//   read_hum()              -> float, % RH        (Modulino Thermo)
//   set_pixels(r, g, b)     -> sets all 8 Modulino Pixels to one colour
//
// UNVERIFIED (check against App Lab's own Modulino / Bridge examples):
//   [B1] library name <Arduino_RouterBridge.h> and Bridge.begin()
//   [B2] Bridge.provide(name, fn) with return values and int arguments.
//        Some examples use Bridge.provide_safe(...) so the call runs in
//        loop() context; if I2C reads hang or crash, switch to provide_safe.
//   [M1] ModulinoPixels::set(index, ModulinoColor, brightness) signature

#include <Arduino_RouterBridge.h>   // [B1]
#include <Modulino.h>

ModulinoThermo thermo;
ModulinoPixels pixels;
bool hasPixels = false;

float readTemp() {
  return thermo.getTemperature();
}

float readHum() {
  return thermo.getHumidity();
}

void setPixels(int r, int g, int b) {
  if (!hasPixels) return;            // board without Pixels: ignore, never crash
  for (int i = 0; i < 8; i++) {
    pixels.set(i, ModulinoColor(r, g, b), 25);   // [M1] brightness 0-100
  }
  pixels.show();
}

void setup() {
  Bridge.begin();                    // [B1]
  Modulino.begin();
  thermo.begin();
  hasPixels = pixels.begin();        // false if no Pixels module is plugged in

  Bridge.provide("read_temp", readTemp);    // [B2]
  Bridge.provide("read_hum", readHum);      // [B2]
  Bridge.provide("set_pixels", setPixels);  // [B2]

  setPixels(0, 0, 40);               // dim blue = "sketch is alive"
}

void loop() {
  delay(10);                         // all work happens in the Bridge callbacks
}
