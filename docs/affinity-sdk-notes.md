# Affinity 3 JavaScript SDK メモ

Affinity 3.2.3 (macOS) の内蔵 MCP から `execute_script` で実際に動かして確認した挙動。SDK ドキュメントは `list_sdk_documentation` / `read_sdk_documentation_topic` で読める。`tests/` 配下は古くて動かないものもあるが、API の使い方の実例として役に立つ (特に `tests/storyTests.js`、`tests/addNodeTests.js`、`tests/polyCurveNodeTests.js`)。

## 環境

| 項目 | 挙動 |
|---|---|
| ファイルアクセス | `~/Desktop` 配下のみ。`app.userDesktopPath` で取得 |
| 戻り値 | 返らない。`console.log` で出力する |
| `render_spread` | 最大 1024px の JPEG。最終確認には `doc.export` で PNG を出す |
| 無題ドキュメント | `doc.close()` は NOT_IMPLEMENTED。誤って作ると手で閉じるしかない |
| `Document.all` | 開いている全ドキュメント。`path` が空なら無題 |

## ドキュメント作成

- `NewDocumentOptions.createDefault()` に `units = UnitType.Pixel` (単数形。`Pixels` は無い)、`width`、`height`、`dpi`、`isTransparentBackground` を設定して `Document.createFromOptions(o)`。
- `isLandscape` を明示しないと 2400×1200 を指定しても 1200×2400 で作られる。

## ノードの追加と特定

- `doc.addNode(nodeDefinition)` は最前面 (`doc.layers` の末尾) に追加する。`doc.layers` は下→上の順。
- 追加したノードは **一意な `userDescription`** で `descriptionInterface.userDescription` を見て探す。`doc.layers.last` は削除後の再追加で外れることがあり、ノードのハンドルは列挙のたびに別オブジェクトになるので差分検出も使えない。誤った特定で `deleteSelection` すると無関係なレイヤーが消える。
- 位置の基準は `node.spreadBaseBox` ({x, y, width, height})。移動は `doc.applyTransform(Transform.createTranslate(dx, dy), node)`。
- `NodeDefinition.setTransform()` は追加位置に反映されない。

## 画像

- `Bitmap.loadFromFile(path, RasterFormat.RGBA8)` → `ImageNodeDefinition.create(RasterFormat.RGBA8)` → `def.bitmap = bm` → `addNode`。
- 透過 PNG はそのまま透過で載る。

## 線・図形

- `PolyCurveNodeDefinition.create(polyCurve, brushFill, lineStyleDescriptor, lineFill, transparencyFill)` の引数に `null` は渡せない。塗りなしは `FillDescriptor.createNone()`。
- `LineStyle.create({...})` は `VectorBrush.createDefault()` 未実装で例外。`LineStyle.createDefaultWithWeight(w)` を使う。
- 追加直後の線は `LineType.None` で見えないことがある。`doc.setLineType(LineType.Solid, node)`、`setLineWeight`、`setLineCap`、`setLineJoin`、`setPenFillDescriptor` を追加後に当てる。
- 曲線は `CurveBuilder.create()` → `begin(p)` → `lineTo(p)` / `addBezier(c1, c2, end)` → `close()` → `createCurve()`。`new PolyCurve()` に `addCurve` する。
- `LineStyleDescriptor.create(ls, { frontArrow: arrowHead.handle })` は `.handle` を渡す必要があるが、矢印ヘッドはノードに保存されなかった。矢印は塗りの三角を別ノードで描く。
- `ShapeNodeDefinition.create(Shape.create(ShapeType.Rectangle), new Rectangle(x, y, w, h), brushFill, lineFill, lineStyleDescriptor, transparencyFill)` で矩形。`ShapeType.keys` で種類一覧。

## 色

- `RGBA8(r, g, b, a)` (`/colours`) は関数で、`Colour` を返す。`Colour.createRGBA8(new RGBA8(...))` と書くと黒 (alpha 1/255) になる。
- 塗りは `FillDescriptor.createSolid(colour, BlendMode.Normal)`。

## テキスト

- `StoryBuilder.create().setToArtisticTextDefaultStyle(doc.dpi, doc.rasterFormat)` → `applyGlyphDelta(StoryDelta.createComposite([...]))` → `addText(text)` → `ArtTextNodeDefinition.createFromStoryBuilder({x, y}, sb)`。
- デルタは **`addText` の前** に適用する。後から当てても既存文字には効かず、既定の見えない状態になる。
- 文字サイズは `GlyphAttDoubleType.Height`。`FontSize` は無い。
- フォントは `StoryDelta.createFamilyName(name)`。名前はインストール済みファミリー名 (`FontFamily.all.map(f => f.name)`) と完全一致が必要。無いと無言でサンセリフに置き換わる (例: 'JetBrains Mono' は無く 'JetBrainsMono Nerd Font' がある、など)。
- 既存テキストの書式変更は `doc.formatText(delta, node)`。
- 文字の実寸は `node.spreadBaseBox`。中央揃えは「一度 (0,0) に描いて測る → 削除 → 目標位置に描き直す」で行う。

## レイヤーエフェクト

- `OuterGlowLayerEffect.create()` に `radius`、`colour`、`intensity`、`opacity`、`enabled = true` を設定し、`doc.setOuterGlowLayerEffect(node, fx)`。外すのは `doc.removeOuterGlowLayerEffect(node)`。OuterShadow / InnerGlow / Outline なども `doc.set<Effect>LayerEffect` の同型。

## レイヤー順

- `doc.executeCommand(DocumentCommand.createMoveNodes(Selection.create(doc, nodes), target, NodeMoveType.After, NodeChildType.Main))` で `target` の直上へ。`Before` で直下へ。
- 画像を差し替えるときは「削除 → 追加 → placeAt → moveNodes」の順で元の位置と順序に戻す。

## 保存・書き出し

- `doc.saveAs(path)` / `doc.save()`。
- `doc.export(path, FileExportOptions.createWithPresetName('PNG'), null, null)`。
- 他のプリセット名は `FileExportOptions.enumeratePresetNames` で列挙できる。
