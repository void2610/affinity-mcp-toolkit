# affinity-mcp-toolkit

Claude Code から Affinity 3 (内蔵 MCP) を操作してビジュアルを組み上げるためのスキル・スクリプト・知見集。

HTML/CSS で描いたパーツをヘッドレス Chromium で透過 PNG に書き出し、Affinity 上で画像・ベクター・テキスト・レイヤーエフェクトとして統合し、書き出し結果を画素で検証する、という一連の流れを扱う。特定の制作物には依存しない。

## 構成

| パス | 内容 |
|---|---|
| `skills/affinity-mcp-compose/` | Affinity MCP (JavaScript SDK) でドキュメント生成・画像配置・曲線・テキスト・エフェクト・レイヤー順を扱う手順と落とし穴 |
| `skills/html-to-png-parts/` | HTML/CSS を Chrome DevTools Protocol 経由で透過 PNG パーツに書き出す手順 |
| `skills/pixel-layout-check/` | ImageMagick で余白・本体境界・端の欠けを画素で検証する手順 |
| `skills/design-variants-gallery/` | 配色・背景・ロゴ・書体などの案出しをギャラリー化して比較し、反復修正する進め方 |
| `scripts/shot.mjs` | ヘッドレス Chromium を CDP で叩いて透過スクリーンショットを撮る Node スクリプト (追加インストール不要) |
| `scripts/measure.sh` | 画像の本体境界・可視範囲・四隅の色を測る ImageMagick ラッパー |
| `scripts/affinity/compose.js` | Affinity SDK 用ヘルパー (ドキュメント作成、画像配置、折れ線・曲線、バッジ付きテキスト、レイヤー順、書き出し) |
| `docs/affinity-sdk-notes.md` | Affinity 3.2 の JavaScript SDK で実際に踏んだ挙動の一覧 |
| `docs/workflow.md` | 全体の作業フローと判断基準 |

## 使い方

スキルは Claude Code のスキルディレクトリにコピーして使う。

```bash
# プロジェクト単位
cp -r skills/* <project>/.claude/skills/
# ユーザー単位
cp -r skills/* ~/.claude/skills/
```

スクリプトは Node 22 以降と ImageMagick (`magick`) を前提とする。ヘッドレス Chromium は Playwright のブラウザキャッシュか Google Chrome を自動検出する (`CHROME_BIN` で明示も可)。

## 前提

- Affinity 3.x で MCP サーバーを有効にし、Claude Code に `affinity` として登録済みであること
- Affinity の SDK はファイルアクセスが `~/Desktop` 配下に限られるため、素材は Desktop 上の作業フォルダに置く

## License

MIT
