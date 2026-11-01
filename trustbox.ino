#include <WiFi.h>
#include <WiFiClientSecure.h>

#define MQTT_MAX_PACKET_SIZE 512
#include <PubSubClient.h>

#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

// Replace these placeholders locally. Do not share real credentials.
const char* WIFI_SSID = "Taha's S24 ";
const char* WIFI_PASSWORD = "arisha123";

// Copy the deployment Address from EMQX Cloud Overview.
// Use only the hostname: no mqtts:// prefix and no path.
const char* MQTT_HOST = "x11d970d.ala.asia-southeast1.emqxsl.com";
const uint16_t MQTT_PORT = 8883;
const char* MQTT_USER = "trackbox1";
const char* MQTT_PASSWORD = "tara@1234";

// Must match the backend subscription and device ID.
const char* MQTT_TOPIC = "trustbox/raw/TB-DEMO-01";

// DigiCert Global Root G2, from the supplied emqxsl-ca.crt file.
static const char MQTT_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";

WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

// GPIO assignments
constexpr int DHT_PIN = 4;      // D4
constexpr int DS18B20_PIN = 2;  // D2
constexpr int SHOCK_PIN = 27;
constexpr int PHOTO_PIN = 34;  // ADC input only
constexpr int TILT_PIN = 32;
constexpr int BUTTON_PIN = 26;
constexpr int BALL_PIN = 33;
constexpr int RGB_R_PIN = 22;
constexpr int RGB_G_PIN = 23;
constexpr int RGB_B_PIN = 21;
constexpr int BUZZER_PIN = 18;
constexpr int REED_PIN = 25;

constexpr int ACTIVE_LEVEL = HIGH;
constexpr int BUTTON_PRESSED_LEVEL = LOW;
constexpr int LIGHT_THRESHOLD = 1800;

#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

unsigned long lastPublishMs = 0;
constexpr unsigned long PUBLISH_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------
// Big-shock detection for the shock and ball switch modules.
//
// These modules chatter on even tiny vibrations. Instead of reading the
// pin once per publish, an interrupt counts every transition. A "big
// shock" is reported only when at least MIN_EDGES transitions happen
// inside WINDOW_MS. The result is then held for EVENT_HOLD_MS so the
// 1-second MQTT publish always catches it.
//
// Tuning: raise MIN_EDGES if small bumps still trigger it,
//         lower MIN_EDGES if real hard hits are missed.
// ---------------------------------------------------------------------
constexpr uint8_t SHOCK_MIN_EDGES = 8;
constexpr uint32_t SHOCK_WINDOW_MS = 200;
constexpr uint8_t BALL_MIN_EDGES = 6;
constexpr uint32_t BALL_WINDOW_MS = 300;
constexpr uint32_t EVENT_HOLD_MS = 1500;  // keep above PUBLISH_INTERVAL_MS

struct Burst {
  volatile uint8_t edges = 0;
  volatile uint32_t windowStart = 0;
  volatile uint32_t activeUntil = 0;
};

Burst shockBurst;
Burst ballBurst;

void IRAM_ATTR burstEdge(Burst &b, uint8_t minEdges, uint32_t windowMs) {
  uint32_t now = millis();
  if (b.edges == 0 || now - b.windowStart > windowMs) {
    b.windowStart = now;
    b.edges = 0;
  }
  uint8_t e = b.edges + 1;
  b.edges = e;
  if (e >= minEdges) {
    b.activeUntil = now + EVENT_HOLD_MS;
    b.edges = 0;
  }
}

void IRAM_ATTR onShockEdge() {
  burstEdge(shockBurst, SHOCK_MIN_EDGES, SHOCK_WINDOW_MS);
}

void IRAM_ATTR onBallEdge() {
  burstEdge(ballBurst, BALL_MIN_EDGES, BALL_WINDOW_MS);
}

bool burstActive(const Burst &b) {
  return (int32_t)(b.activeUntil - millis()) > 0;
}

void setRgb(bool red, bool green, bool blue) {
  // For a common-anode RGB LED, invert these HIGH/LOW values.
  digitalWrite(RGB_R_PIN, red ? HIGH : LOW);
  digitalWrite(RGB_G_PIN, green ? HIGH : LOW);
  digitalWrite(RGB_B_PIN, blue ? HIGH : LOW);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWi-Fi connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String clientId =
      "trackbox-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    Serial.printf("Connecting to EMQX at %s:%u ...\n",
                  MQTT_HOST, MQTT_PORT);

    bool connected = mqtt.connect(
      clientId.c_str(), MQTT_USER, MQTT_PASSWORD);

    if (connected) {
      Serial.println("MQTT connected");
    } else {
      Serial.printf("MQTT failed, state=%d; retrying in 3 seconds\n",
                    mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(SHOCK_PIN, INPUT);
  pinMode(TILT_PIN, INPUT);
  pinMode(BALL_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(REED_PIN, INPUT_PULLUP);

  pinMode(RGB_R_PIN, OUTPUT);
  pinMode(RGB_G_PIN, OUTPUT);
  pinMode(RGB_B_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Count shock / ball switch transitions in the background.
  attachInterrupt(digitalPinToInterrupt(SHOCK_PIN), onShockEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(BALL_PIN), onBallEdge, CHANGE);

  setRgb(false, true, false);
  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);
  dht.begin();
  ds18b20.begin();

  secureClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setSocketTimeout(15);

  connectWiFi();
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqtt.connected()) {
    connectMqtt();
  }
  mqtt.loop();

  if (millis() - lastPublishMs < PUBLISH_INTERVAL_MS) {
    return;
  }
  lastPublishMs = millis();

  float humidity = dht.readHumidity();
  float dhtTempC = dht.readTemperature();

  ds18b20.requestTemperatures();
  float probeTempC = ds18b20.getTempCByIndex(0);
  bool probeOk = probeTempC != DEVICE_DISCONNECTED_C;

  int photoRaw = analogRead(PHOTO_PIN);
  bool lightInside = photoRaw > LIGHT_THRESHOLD;

  // Shock and ball switch: true only after a burst of transitions
  // (a big shock), held for EVENT_HOLD_MS.
  bool shock = burstActive(shockBurst);
  bool ballActive = burstActive(ballBurst);

  bool tilted = digitalRead(TILT_PIN) == ACTIVE_LEVEL;
  bool deliveryButton =
    digitalRead(BUTTON_PIN) == BUTTON_PRESSED_LEVEL;
  bool reedTriggered = digitalRead(REED_PIN) == ACTIVE_LEVEL;

  bool breach =
    shock || tilted || ballActive || lightInside || reedTriggered;

  setRgb(breach, !breach, false);
  digitalWrite(BUZZER_PIN, breach ? HIGH : LOW);

  char dhtTempJson[16];
  char humidityJson[16];
  char probeTempJson[16];

  if (isnan(dhtTempC)) {
    strcpy(dhtTempJson, "null");
  } else {
    snprintf(dhtTempJson, sizeof(dhtTempJson), "%.2f", dhtTempC);
  }

  if (isnan(humidity)) {
    strcpy(humidityJson, "null");
  } else {
    snprintf(humidityJson, sizeof(humidityJson), "%.2f", humidity);
  }

  if (!probeOk) {
    strcpy(probeTempJson, "null");
  } else {
    snprintf(probeTempJson, sizeof(probeTempJson), "%.2f", probeTempC);
  }

  char payload[420];
  snprintf(payload, sizeof(payload),
           "{"
           "\"device_id\":\"TB-DEMO-01\","
           "\"uptime_ms\":%lu,"
           "\"temperature_dht_c\":%s,"
           "\"humidity_pct\":%s,"
           "\"temperature_ds18b20_c\":%s,"
           "\"photo_raw\":%d,"
           "\"light_inside\":%s,"
           "\"shock\":%s,"
           "\"tilt\":%s,"
           "\"ball_switch\":%s,"
           "\"reed_triggered\":%s,"
           "\"delivery_button\":%s,"
           "\"breach\":%s"
           "}",
           (unsigned long)millis(),
           dhtTempJson,
           humidityJson,
           probeTempJson,
           photoRaw,
           lightInside ? "true" : "false",
           shock ? "true" : "false",
           tilted ? "true" : "false",
           ballActive ? "true" : "false",
           reedTriggered ? "true" : "false",
           deliveryButton ? "true" : "false",
           breach ? "true" : "false");

  Serial.println(payload);

  bool sent = mqtt.publish(MQTT_TOPIC, payload);
  if (sent) {
    Serial.println("MQTT publish OK");
  } else if (!mqtt.connected()) {
    Serial.printf("MQTT publish failed: disconnected, state=%d\n",
                  mqtt.state());
  } else {
    Serial.printf("MQTT publish failed: payload length=%u\n",
                  (unsigned int)strlen(payload));
  }
}
