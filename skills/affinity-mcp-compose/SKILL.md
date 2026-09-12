---
name: affinity-mcp-compose
description: Affinity 3 の内蔵 MCP (JavaScript SDK) を Claude Code から操作し、ドキュメント生成・画像配置・ベクター線・テキスト・レイヤーエフェクト・レイヤー順の変更・書き出しを行う手順。トリガー: 「Affinity で統合して」「Affinity に配置して」「Affinity で矢印を描いて」など、Affinity 上で素材を組み上げる依頼。
---

# Affinity MCP でビジュアルを組む

## 前提

- 最初に `read_sdk_documentation_topic('preamble')` を読む (MCP の必須手順)。preamble 末尾には過去セッションのヒントが溜まっているので、それも読む。
- 何かを実験で解決したら、その場で `add_sdk_hint` に登録する。次回の自分が同じ穴に落ちない。
- SDK のファイルアクセスは `~/Desktop` 配下のみ。素材はまず `app.userDesktopPath` 配下の作業フォルダにコピーする。
- スクリプトの戻り値は返らない。結果は `console.log` で出す。
- `render_spread` (最大 1024px の JPEG) は確認用。最終確認は `doc.export` で PNG を書き出して画素で見る (`pixel-layout-check` スキル)。

## 基本フロー

1. ドキュメント作成 (`scripts/affinity/compose.js` の `createPixelDoc`)
2. ラスター素材を下から順に `addNode` → 位置合わせ (`placeAt`)
3. ベクター (線・矢印・バッジ矩形) とテキストを追加
4. レイヤー順を `createMoveNodes` で整える
5. `doc.saveAs` / `doc.save` と `doc.export` (PNG)

## 必ず守ること

- **新規ノードは一意な `userDescription` で特定する**。`doc.layers.last` やハンドル差分で探してはいけない (削除後の再追加は途中に挿入されることがあり、別レイヤーを消す事故になる)。
- 画像は `Bitmap.loadFromFile` → `ImageNodeDefinition.create(RasterFormat.RGBA8)` → `def.bitmap = bm` → `doc.addNode(def)`。配置は追加後に `doc.applyTransform(Transform.createTranslate(dx, dy), node)`。`NodeDefinition.setTransform` は効かない。
- 位置の基準は `node.spreadBaseBox` (スプレッド座標の {x,y,width,height})。「目標座標 − 現在の box」で translate する `placeAt` を使う。
- 線は `PolyCurveNodeDefinition.create(polyCurve, brushFill, lineStyleDescriptor, lineFill, transparencyFill)`。`null` は渡せないので `FillDescriptor.createNone()` を使う。追加直後は線種が None のことがあるので `doc.setLineType(LineType.Solid, node)` / `setLineWeight` / `setLineCap` / `setPenFillDescriptor` を追加後に必ず当てる。
- 色は `RGBA8(r,g,b,a)` (関数、`/colours`)。`Colour.createRGBA8(new RGBA8(...))` と書くと黒になる。
- テキストは `StoryBuilder` に **書式デルタを先に適用してから** `addText`。サイズは `GlyphAttDoubleType.Height`。フォント名はインストール済みファミリー名と完全一致が必要 (`FontFamily.all` で確認)。
- 矢印ヘッドは `LineStyleDescriptor` の arrowhead が保存されないため、塗りの三角を別ノードとして描く。
- レイヤーエフェクトは `OuterGlowLayerEffect.create()` に radius / colour / intensity / opacity / enabled を設定し `doc.setOuterGlowLayerEffect(node, fx)`。外すのは `doc.removeOuterGlowLayerEffect(node)`。
- レイヤー順は `doc.executeCommand(DocumentCommand.createMoveNodes(Selection.create(doc, nodes), target, NodeMoveType.After, NodeChildType.Main))`。`doc.layers` は下→上、追加ノードは末尾 (最前面)。
- 無題ドキュメントを間違って作ると SDK からは閉じられない (`close` は NOT_IMPLEMENTED)。作成前に `NewDocumentOptions` を確定させる (単位は `UnitType.Pixel`、`isLandscape` を明示)。

## 位置の考え方

- 素材 PNG は「影やグローを含む切り出し」なので、配置座標は画像左上ではなく **本体 (枠線) の左上** で決める。本体オフセットは `pixel-layout-check` の `measure.sh body` で測っておく。
- CSS の `width` は content-box。padding と border を足した実寸を使う。
- 線の起点・終点は要素本体の中心から出す。合流線を左右対称にしたいなら、中央要素の中心から上下の中心が等距離になるよう「間隔」で調整する (要素の高さが違っても間隔で吸収できる)。

## 確認

- 変更のたびに `doc.export` で PNG を出し、拡大切り出し (`magick -crop`) で接続部・端・余白を見る。`render_spread` だけで判断しない。
- 四隅の画素が背景色であること、可視範囲の左右余白が意図どおりであることを `measure.sh` で確かめる。

詳細な API メモは `docs/affinity-sdk-notes.md`。
