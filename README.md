# Magnetic North

[Open Magnetic North](https://coolcode.ca/magneticnorth/) · a CoolCode browser application.

Calculate magnetic declination, inclination and field strength at any valid coordinate using the standard NOAA/BGS **WMM2025** model. Convert between true and magnetic bearings, compare saved starting places, and inspect the model’s projected change from 2025 through 2029. All calculations run locally; no API key, account, geolocation permission or backend is required.

<!-- coolcode:guide -->
Enter latitude, longitude, WGS84 ellipsoid height and a date in **2025–2029**, or start with Langley or Halifax. East declination is positive: **true bearing = magnetic bearing + declination**. The compass drawing is a schematic, not a reading from your device. The chart shows one model’s predictions at a fixed place, not observed magnetic history. Save receipt JSON or CSV to retain your result; inputs are not saved automatically. Add places in **web/config.json** and push to publish them.
<!-- /coolcode:guide -->

## How to use it

1. Choose coordinates. Latitude is positive north; longitude is positive east and negative west. Presets are conveniences, not the only supported inputs.
2. Enter metres above the **WGS84 ellipsoid**. Zero is a mathematical reference, not your elevation above sea level or ground. This app performs no geoid correction.
3. Choose a calendar date from 1 January 2025 through 31 December 2029. The calculation uses 00:00 UTC on that day; the initial date uses the visitor’s calendar date. Dates beyond the bundled model’s validity are rejected, not silently extrapolated.
4. Calculate. Positive declination means magnetic north lies east of true north. Positive inclination points down into Earth. Field strengths are in nanoteslas (nT).
5. Enter a true or magnetic bearing. For example, with a hypothetical +15° declination, 90° true becomes 75° magnetic; 90° magnetic becomes 105° true. Bearings wrap to 0–360°.
6. Save a JSON receipt including coordinates, date, model provenance and outputs, or export a CSV of the calculated values.

The interface accepts −1,000 to 850,000 m above the ellipsoid. These application input bounds do **not** imply equal model accuracy throughout that range. NOAA’s practical altitude/depth limits depend on geomagnetic conditions, local ground and the requested component.

## What the evidence means

WMM2025 models Earth’s large-scale internal magnetic field. It does not represent local metal, all crustal magnetic anomalies, electrical equipment or short-term storm effects. It is not a phone-compass sensor or a guarantee of safe navigation.

Horizontal intensity below 2,000 nT is NOAA’s compass **blackout zone**; 2,000–6,000 nT is its **caution zone**. Both are flagged. Bearing conversion is withheld in blackout zones and exactly at geographic poles, where true north is not a unique local direction. Calculated vector components remain inspectable.

The declination uncertainty uses NOAA’s WMM2025 surface estimate, `sqrt(0.26² + (5417/H)²)` degrees, where H is in nT. It represents a one-standard-deviation model estimate at Earth’s surface, not a confidence bound for every real compass reading or an estimate valid at all altitudes.

The time chart recalculates the same WMM2025 model at the same coordinate and height. It is a prediction across the model period, not a comparison of observations. It unwraps angles around ±180° solely to draw a continuous line.

## Expand or customize

Edit [`web/config.json`](web/config.json). Every configured place appears as a shortcut and a comparison-table row; no fixed list length is embedded in the UI. For example, append:

```json
{
  "id": "toronto",
  "label": "Toronto, ON",
  "latitude": 43.6532,
  "longitude": -79.3832
}
```

- `presets`: up to 100 unique IDs, labels, numeric latitude and longitude. All valid visitor coordinates remain accepted without editing this list.
- `defaultLocation`: the preset ID used at startup.
- `defaultAltitudeMetres`: initial ellipsoid height, normally `0`.
- `defaultBearing`: initial bearing, normally `90`.
- `trendSamples`: number of model dates in the chart, constrained to 2–101 for responsive local rendering.

Push the edit to `main`. **Magnetic North · Check and publish** tests, builds offline and deploys it. No source refresh is needed for a preset change, and no recurring collector is configured: coefficients are a versioned model, not a daily feed.

To update the model after 2029, obtain the new official coefficient file and test vectors, then deliberately update the epoch/name validation, date limits, trend interval, provenance and explanatory copy together. The app must continue to reject dates outside the installed model period. Do not replace coefficients alone and leave WMM2025 labels in place.

## Sources, provenance and reuse

- [NOAA NCEI World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model).
- [Official WMM2025 coefficient package and 100 test points](https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip).
- [NOAA accuracy, limitations, blackout zones and error model](https://www.ncei.noaa.gov/products/world-magnetic-model/accuracy-limitations-error-model).
- [WMM2025 dataset DOI](https://doi.org/10.25921/aqfd-sd83): NOAA NCEI Geomagnetic Modeling Team; British Geological Survey, 2024.
- Numerical synthesis is a JavaScript adaptation of NOAA’s [Legacy C `geomag.c`](https://www.ngdc.noaa.gov/geomag/WMM/data/WMM2020/WMM2020LegacyC.zip), with the **2025 coefficients**, not the 2020 model. WGS84 constants, Schmidt normalization, spherical-harmonic recurrence, coordinate rotations and geographic-pole handling are retained; per-call arrays replace mutable calculation caching.

The original coefficient file is preserved at `web/data/WMM.COF`. `web/data/model-info.json` records its retrieval time, source URL and SHA-256; the retrieval time is not the epoch or a field observation date. Original test vectors are preserved at `tests/fixtures/WMM2025_TestValues.txt`.

**Public-domain notice:** this tool incorporates numerical code and coefficients distributed by NOAA as U.S. Government material. That material is not subject to copyright protection. The World Magnetic Model is jointly developed with the British Geological Survey. No NOAA/NGA/BGS endorsement is implied.

## Privacy

Coordinates, heights, dates and bearings stay in this tab. Local files containing the model and configuration are loaded from CoolCode. Nothing is sent to a magnetic-field API, no geolocation is requested and inputs are not automatically persisted. The standard CoolCode visit counter receives the tool ID, not these inputs. Clicking an official source link opens that provider’s site. Exports are initiated by the visitor.

## Development and checks

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

The build requires only Python’s standard library and copies relative assets to `dist/`. Node is used for tests. Browser CI uses test-only Playwright to exercise coordinates beyond the presets, date bounds, raw components, bearing conversion, downloads and mobile layout under a project subpath.

Numerical tests cover all **100 official WMM2025 test points**. Angular tolerances are 0.0051° because the published angular columns are rounded to 0.01°. Component tolerances are 0.002 nT; the JavaScript port’s observed maximum difference is below 0.001 nT. Tests also cover leap years, model expiry, poles, coefficient completeness, bearing signs and wrapping, and adding a fifth preset location.
