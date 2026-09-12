---
name: html-to-png-parts
description: HTML/CSS で描いたパーツ (カード、ロゴ、背景、バッジ等) をヘッドレス Chromium の DevTools Protocol で透過 PNG に書き出す手順。追加インストールなしで Playwright のブラウザキャッシュか Google Chrome を使う。トリガー: 「HTML を PNG にして」「透過で書き出して」「パーツごとに切り出して」。
---

# HTML/CSS → 透過 PNG パーツ

## なぜ HTML で描くか

グラデーション・ぼかし・Web フォント・角丸・影は CSS が数行で済み、再編集も差分で追える。Affinity 側は「配置・線・テキスト・エフェクト」に専念させる。

## 書き出し

```bash
node scripts/shot.mjs <html> <out.png> <幅> <高さ> [scale]
```

- `scale=2` で 2 倍解像度、`0.5` で縮小プレビュー。
- Chromium は `CHROME_BIN` 環境変数 → Playwright キャッシュ (`~/Library/Caches/ms-playwright/chromium_headless_shell-*`) → Google Chrome の順で探す。
- 背景は `Emulation.setDefaultBackgroundColorOverride` で透明にしているので、`html,body{background:transparent}` にすれば透過 PNG になる。`--default-background-color` フラグは headless shell では効かない。
- Web フォントの読み込み待ちとして 2.5 秒待ってから撮る。オフラインだと代替書体になるので、書き出し後に字形を目視する。

## パーツの切り出し方

1. 全パーツを 1 つの HTML (最終構図) に置く。
2. パーツごとに「他を `visibility:hidden` にした」レイヤー HTML を生成して、**同じキャンバスサイズで** 描画する。レイアウト由来の座標がそのまま使える。
3. `magick in.png -trim +repage out.png` で切り出し、`-format "%X,%Y"` の切り出しオフセットを記録する。影やグローを含めて切り出されるので、本体位置は `measure.sh body` で別途測る。

## 落とし穴

- **body の既定 margin (8px)**。`html,body{margin:0;padding:0}` を必ず書く。忘れると全パーツが (8,8) ずれ、背景の右下 8px が欠け、左上に白い縁が出る。書き出し後に四隅の画素を確認する (`measure.sh corners`)。
- **キャンバス端でのグロー切れ**。端に近い要素はキャンバスより大きい幅 (例 2800px) で描画してから切り出す。
- **`width` は content-box**。padding と border を足した実寸を本体幅として扱う。
- 描画に使った HTML はパーツ PNG と一緒に保存する。後で色や文言を変えるときの原本になる。
