<div align="center">

English | [日本語](README.ja.md)

# Infinite Monkey Theorem Simulator

A site that generates one random hiragana character per second and waits for the day it spells out the whole of Osamu Dazai's "Run, Melos!".

[![Site](https://img.shields.io/badge/site-imt.lapius7.com-16a34a)](https://imt.lapius7.com)
![Bun](https://img.shields.io/badge/runtime-Bun-f472b6)
![MySQL](https://img.shields.io/badge/database-MySQL-0ea5e9)

</div>

Source code of [imt.lapius7.com](https://imt.lapius7.com). It is published for reference and is not meant to be self-hosted.

## What it does

- A single server process generates one character per second, drawn uniformly from the 46 basic hiragana (including ん and を). It keeps running when nobody is watching.
- It tracks how many characters at the start of the target text the generated sequence matches in a row, falling back by the KMP failure function on a mismatch.
- When the whole text matches, generation stops and the completion time is recorded and shown on the site.
- The page shows the stream of characters being generated, total count, uptime, current match length, longest match so far, an estimate of the probability of a full match, the target text with the matched part highlighted, and a log of recent characters. Updates arrive over Server-Sent Events and the client reconnects and catches up by itself.
- Totals, match state and the longest match are stored in MySQL, survive restarts, and count only characters actually generated. The generated characters themselves are kept for the latest 86,400 only (one day), oldest deleted first.

## Target text

The target is **10,685 characters** of basic hiragana. `bun run target` redoes the steps below from scratch (`scripts/build-target.ts`).

1. Fetch ["Run, Melos!" from Aozora Bunko](https://www.aozora.gr.jp/cards/000035/files/1567_14913.html) and extract the body only, without header, footer, bibliographic notes or `［＃…］` annotations.
2. Replace ruby (88 of them) with its reading.
3. Fill in kanji without ruby with readings from morphological analysis (kuromoji). Words it cannot read (此, 警吏, 刑吏, お互い, 裂目 and others) and misread numerals (一人, 二人, 三人, 三里) are fixed by a correction table in the script.
4. Drop everything except hiragana and katakana (punctuation, symbols, the long vowel mark, spaces, ASCII) and convert katakana to hiragana.
5. Reduce voiced marks, semi-voiced marks and small kana to basic kana (が→か, ぱ→は, っ→つ, ゃ→や, ゔ→う). The script fails if anything outside the 46 characters remains.

> [!NOTE]
> The readings of kanji were chosen by machine and the full text has not been proofread by a person. The readings used are listed in `data/target.readings.tsv`.

## Probability of a full match

Each character matches with probability 1/46, so a run of 10,685 characters equals the target with probability 46^-10,685 (about 10^-17,766). The expected wait is about 10^17,759 years, roughly 10^17,748 times the age of the universe. The site also shows the probability that a full match has already happened, computed from the current total.
