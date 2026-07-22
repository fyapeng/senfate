# Data policy

The Git repository contains only source code, specifications, compact canonical
rules and the seven TXT source editions. Large research material stays under
`local-data/`, which is ignored.

Tracked rule baseline:

```text
books:          7
source records: 37,231
rule families:  11,306
corpus version: 4.0
SHA-256:        44f8a77abac4c0a607ef87e697730e0bd8f6e9ce8bba5d9ce5abc1bf797cb4e4
```

Any future local dataset that influences a released model needs a small tracked
manifest containing its logical name, version, byte size, digest, provenance and
reproduction command. The binary itself remains local or moves to suitable object
storage.

The 230,120-byte solar-term table is a deliberate exception: it is a compact runtime dependency explicitly generated from NASA/JPL Horizons DE441. Its tracked manifest pins the digest, query and reproduction command; no large ephemeris kernel is stored in Git.
