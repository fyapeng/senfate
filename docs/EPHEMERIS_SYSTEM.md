# Solar-term ephemeris

## Standard

The pinned table uses NASA/JPL Horizons DE441 output for the Sun observed from the Earth geocenter. The requested quantity is observer-centered IAU76/80 ecliptic-of-date apparent longitude (`ObsEcLon`, quantity 31), with light-time, gravitational deflection and stellar aberration included and atmospheric refraction disabled.

This matches the Horizons convention for determining Earth seasonal boundaries. The public calculation domain is 1850–2200. The pinned table retains 1849 and 2201 as boundary buffers and contains all crossings at multiples of 15 degrees. (The currently shipped table still covers 1849–2101; regenerate to 2201 to enable the full domain — see Generation below.)

## Generation

The generator requests six-hour samples in ten-year blocks and linearly solves each 15-degree crossing between adjacent samples. It verifies that every Gregorian year contains exactly 24 strictly ordered terms. Runtime calculation reads the pinned table and never calls Horizons.

```text
NODE_USE_ENV_PROXY=1 pnpm --filter @senfate/ephemeris \
  generate:solar-terms -- 1849 2201
```

The manifest records the DE441 source, query settings, generation time, byte size and SHA-256 digest. CI checks the digest and table structure.

## Time scale and uncertainty

Horizons emits UT1 before 1962 and UTC from 1962 onward. SenFate assigns:

- 120 seconds of uncertainty before 1962 for the UT1/civil-time boundary;
- 5 seconds from 1962 through the table generation instant;
- 120 seconds after generation because future UTC leap seconds are not yet known.

Calendar evaluation treats a term time as an interval. A birth-time interval must lie strictly after the latest possible preceding `jie` and before the earliest possible following `jie`. Otherwise calculation returns `ephemeris-window-mismatch`.

## Bazi month mapping

Only the twelve `jie` boundaries advance the Bazi month:

```text
立春 寅  惊蛰 卯  清明 辰  立夏 巳  芒种 午  小暑 未
立秋 申  白露 酉  寒露 戌  立冬 亥  大雪 子  小寒 丑
```

`compileCertifiedBaziCalendar` performs historical IANA-zone resolution, obtains the enclosing `jie` window, derives the four pillars and calculates major-luck direction, start age and periods. Runtime offsets come from the exact `moment-timezone@0.6.3` dependency and its bundled IANA 2026c distribution, rather than the host's `Intl` database. Repeated and skipped local times are detected from all offsets declared by the selected zone and remain failure-closed. Every result carries the provider, IANA version and ephemeris digest.
