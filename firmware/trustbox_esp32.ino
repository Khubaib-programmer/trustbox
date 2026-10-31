/*
 * TrustBox ESP32 Firmware
 * Tamper-Evident Delivery Black Box with Cryptographic Hash Chaining & HMAC-SHA256
 *
 * Requirements:
 * - ESP32 Board package for Arduino
 * - PubSubClient library (or MQTTClient)
 * - WiFiClientSecure (built into ESP32 core)
 * - mbedtls (built into ESP32 core)
 * - ArduinoJson (v6 or v7)
 * - Optional DHT / Adafruit MPU6050 libraries for physical sensors
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "mbedtls/md.h"
#include "mbedtls/sha256.h"
#include <time.h>

// ==========================================
// CONFIGURATION (Set your WiFi & HiveMQ credentials)
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// HiveMQ Cloud broker settings (TLS, port 8883)
const char* MQTT_BROKER   = "your-cluster-id.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "trustbox_user";
const char* MQTT_PASS     = "YourSecurePassword123";

// Box Identity & Crypto Key (NEVER commit secrets to public VCS)
const char* BOX_ID        = "TB-001";
const char* DEVICE_KEY    = "trustbox-super-secret-key-32ch"; // Shared secret matching backend .env

// Publishing intervals
const unsigned long TELEMETRY_INTERVAL_MS = 2000; // 2 seconds

// Hardware Pins (Adjust to match your wiring, or leave enabled for internal simulation)
#define PIN_SHOCK_SENSOR  4   // Vibration / SW-420 or push button
#define PIN_LID_REED      5   // Magnetic reed switch (LOW = closed, HIGH = open)
#define PIN_LIGHT_ADC     34  // LDR / Photoresistor analog input
#define PIN_LED_STATUS    2   // Built-in LED for visual heartbeat

// Topics
char TOPIC_TELEMETRY[64];
char TOPIC_EVENT[64];

// Global State
WiFiClientSecure secureEspClient;
PubSubClient mqttClient(secureEspClient);

int current_seq = 0;
char current_prev_hash[65] = "0000000000000000000000000000000000000000000000000000000000000000";
unsigned long lastTelemetryTime = 0;

// NTP Server for authentic timestamps
const char* NTP_SERVER = "pool.ntp.org";

// ==========================================
// CRYPTOGRAPHY: SHA256 & HMAC-SHA256
// ==========================================

// Converts raw binary digest (32 bytes) into 64-char lowercase hex string
void bytesToHex(const unsigned char* bytes, size_t length, char* outputHex) {
  for (size_t i = 0; i < length; i++) {
    sprintf(outputHex + (i * 2), "%02x", bytes[i]);
  }
  outputHex[length * 2] = '\0';
}

// Compute SHA256 hash -> 64-character lowercase hex string
void computeSHA256(const char* input, char* outputHex) {
  unsigned char digest[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0); // 0 = SHA-256
  mbedtls_sha256_update(&ctx, (const unsigned char*)input, strlen(input));
  mbedtls_sha256_finish(&ctx, digest);
  mbedtls_sha256_free(&ctx);

  bytesToHex(digest, 32, outputHex);
}

// Compute HMAC-SHA256 signature -> 64-character lowercase hex string
void computeHMAC(const char* key, const char* message, char* outputHex) {
  unsigned char hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1); // 1 = HMAC
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)message, strlen(message));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  bytesToHex(hmacResult, 32, outputHex);
}

// Get Unix Epoch seconds
unsigned long getEpochSeconds() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    // If NTP has not synced yet, fallback to millis offset
    return 1730380000 + (millis() / 1000);
  }
  time(&now);
  return (unsigned long)now;
}

// ==========================================
// RECORD CREATION & PUBLISHING
// ==========================================

void publishRecord(float temp_c, float humidity, int shock, int tilt, int flipped, int light, int lid_open, const char* eventName, bool isEventTopic = false) {
  unsigned long ts = getEpochSeconds();

  // 1. Format floats with strictly 1 decimal place
  char tempStr[16];
  char humStr[16];
  snprintf(tempStr, sizeof(tempStr), "%.1f", temp_c);
  snprintf(humStr, sizeof(humStr), "%.1f", humidity);

  const char* eventStr = (eventName == NULL || strlen(eventName) == 0) ? "NONE" : eventName;

  // 2. Build Canonical Serialization String:
  // box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
  char canonical[512];
  snprintf(canonical, sizeof(canonical),
    "%s|%d|%lu|%s|%s|%d|%d|%d|%d|%d|%s|%s",
    BOX_ID,
    current_seq,
    ts,
    tempStr,
    humStr,
    shock,
    tilt,
    flipped,
    light,
    lid_open,
    eventStr,
    current_prev_hash
  );

  // 3. Compute hash = SHA256(canonical)
  char hashHex[65];
  computeSHA256(canonical, hashHex);

  // 4. Compute sig = HMAC-SHA256(DEVICE_KEY, hash)
  char sigHex[65];
  computeHMAC(DEVICE_KEY, hashHex, sigHex);

  // 5. Construct JSON Payload
  StaticJsonDocument<768> doc;
  doc["box_id"]    = BOX_ID;
  doc["seq"]       = current_seq;
  doc["ts"]        = ts;
  doc["temp_c"]    = atof(tempStr);
  doc["humidity"]  = atof(humStr);
  doc["shock"]     = shock;
  doc["tilt"]      = tilt;
  doc["flipped"]   = flipped;
  doc["light"]     = light;
  doc["lid_open"]  = lid_open;
  doc["event"]     = eventStr;
  doc["prev_hash"] = current_prev_hash;
  doc["hash"]      = hashHex;
  doc["sig"]       = sigHex;

  char jsonBuffer[1024];
  size_t bytes = serializeJson(doc, jsonBuffer);

  const char* topic = isEventTopic ? TOPIC_EVENT : TOPIC_TELEMETRY;
  bool success = mqttClient.publish(topic, jsonBuffer, bytes);

  if (success) {
    Serial.printf("[SENT #%d] Topic: %s | Temp: %s C | Hash: %.8s... | Sig: %.8s...\n",
      current_seq, topic, tempStr, hashHex, sigHex);
    
    // Update hash chain state for subsequent record
    strncpy(current_prev_hash, hashHex, sizeof(current_prev_hash) - 1);
    current_prev_hash[64] = '\0';
    current_seq++;
  } else {
    Serial.printf("[FAILED #%d] Publish error, will retry.\n", current_seq);
  }
}

// ==========================================
// NETWORK & MQTT SETUP
// ==========================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  // Init time via NTP
  configTime(0, 0, NTP_SERVER);
  Serial.println("Synchronizing NTP time...");
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to HiveMQ Cloud TLS Broker...");
    // HiveMQ cloud certificates (insecure root mode or load ISRG Root X1 CA)
    secureEspClient.setInsecure(); // For quick hackathon setup with TLS
    
    String clientId = "TrustBox-" + String(BOX_ID) + "-" + String(random(1000, 9999));
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" Connected!");
      // Flash LED to signal broker connection
      digitalWrite(PIN_LED_STATUS, HIGH);
      delay(200);
      digitalWrite(PIN_LED_STATUS, LOW);
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Waiting 3 seconds before retry...");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=========================================");
  Serial.println("  TRUSTBOX - Tamper-Evident Black Box    ");
  Serial.println("=========================================");

  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_SHOCK_SENSOR, INPUT_PULLUP);
  pinMode(PIN_LID_REED, INPUT_PULLUP);

  snprintf(TOPIC_TELEMETRY, sizeof(TOPIC_TELEMETRY), "trustbox/%s/telemetry", BOX_ID);
  snprintf(TOPIC_EVENT, sizeof(TOPIC_EVENT), "trustbox/%s/event", BOX_ID);

  connectWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(1024); // Support payloads ~700-1000 bytes
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Read physical sensors or generate realistic demo values
  unsigned long now = millis();

  // Check for shock event (drop detection)
  static int lastShockState = LOW;
  int currentShock = digitalRead(PIN_SHOCK_SENSOR) == HIGH ? 1 : 0;
  if (currentShock == 1 && lastShockState == LOW) {
    Serial.println(">>> IMPACT DETECTED! Publishing DROP event");
    publishRecord(6.2, 52.0, 1, 0, 0, 30, 0, "DROP", true);
    delay(200); // debounce
  }
  lastShockState = currentShock;

  // Regular periodic telemetry
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    // Default safe cold-chain medicine baseline: ~4.5 - 5.5 C
    float simulatedTemp = 4.8 + ((random(-10, 11)) / 10.0);
    float simulatedHum  = 54.0 + ((random(-20, 21)) / 10.0);
    int simulatedLight  = analogRead(PIN_LIGHT_ADC);
    if (simulatedLight > 4095 || simulatedLight < 0) simulatedLight = 40;
    int lidState        = digitalRead(PIN_LID_REED) == HIGH ? 1 : 0;

    publishRecord(simulatedTemp, simulatedHum, 0, 0, 0, simulatedLight, lidState, "NONE", false);
  }
}

