// Affinity 3.2 の execute_script に貼り付けて使うヘルパー (SDK の挙動は docs/affinity-sdk-notes.md)
'use strict';

const { app } = require('/application');
const { Document, NewDocumentOptions, FileExportOptions } = require('/document');
const { ImageNodeDefinition, PolyCurveNodeDefinition, ArtTextNodeDefinition, ShapeNodeDefinition, NodeChildType } = require('/nodes');
const { Shape, ShapeType } = require('/shapes');
const { Bitmap, RasterFormat } = require('/rasterobject');
const { CurveBuilder, PolyCurve, Rectangle, Transform } = require('/geometry');
const { FillDescriptor, BlendMode } = require('/fills');
const { RGBA8 } = require('/colours');
const { LineStyle, LineStyleDescriptor, LineType, LineCap, LineJoin } = require('/linestyle');
const { StoryBuilder } = require('/storybuilder');
const { StoryDelta, GlyphAttDoubleType } = require('/storydelta');
const { FontWeight } = require('/fonts');
const { OuterGlowLayerEffect } = require('/layereffects');
const { DocumentCommand, NodeMoveType } = require('/commands');
const { Selection } = require('/selections');
const { UnitType } = require('/units');

const solid = (rgb) => FillDescriptor.createSolid(RGBA8(...rgb), BlendMode.Normal);

// --- ドキュメント -----------------------------------------------------------

// ピクセル単位のドキュメントを作る。isLandscape を明示しないと幅高が入れ替わる
function createPixelDoc(width, height, dpi = 72) {
  const o = NewDocumentOptions.createDefault();
  o.units = UnitType.Pixel;            // 'Pixels' ではなく 'Pixel'
  o.isLandscape = width >= height;
  o.width = width; o.height = height; o.dpi = dpi;
  o.isTransparentBackground = false;
  return Document.createFromOptions(o);
}

// --- ノード探索・配置 ---------------------------------------------------------

const allNodes = (doc) => { const a = []; for (const n of doc.layers) a.push(n); return a; };

// 新規ノードは一意な userDescription で探す (layers.last やハンドル比較は不可)
const findNode = (doc, name) => allNodes(doc).find((n) => String(n.descriptionInterface.userDescription) === name) || null;

// spreadBaseBox の左上を (x, y) に合わせる
function placeAt(doc, node, x, y) {
  const b = node.spreadBaseBox;
  doc.applyTransform(Transform.createTranslate(x - b.x, y - b.y), node);
}

// target の直上 (After) / 直下 (Before) に並べ替える
function moveNodes(doc, nodes, target, mode = NodeMoveType.After) {
  doc.executeCommand(DocumentCommand.createMoveNodes(Selection.create(doc, nodes), target, mode, NodeChildType.Main));
}

// --- 画像 -----------------------------------------------------------------

// PNG を画像ノードとして追加し (x, y) に置く。パスは ~/Desktop 配下のみ
function addImage(doc, name, path, x, y) {
  const bm = Bitmap.loadFromFile(path, RasterFormat.RGBA8);
  const def = ImageNodeDefinition.create(RasterFormat.RGBA8);
  def.bitmap = bm; def.userDescription = name;
  doc.addNode(def);                       // setTransform は効かないので追加後に動かす
  const n = findNode(doc, name);
  placeAt(doc, n, x, y);
  return n;
}

// --- 線 -------------------------------------------------------------------

function styleLine(doc, node, rgb, weight) {
  // 追加直後は LineType.None のことがあるので必ず当てる
  doc.setLineType(LineType.Solid, node);
  doc.setLineWeight(weight, node);
  doc.setLineCap(LineCap.Round, node);
  doc.setLineJoin(LineJoin.Round, node);
  doc.setPenFillDescriptor(solid(rgb), node);
}

// build(cb) で CurveBuilder にパスを組む。fill=true で閉じた塗り図形 (矢印ヘッド等)
function addPath(doc, name, build, rgb, weight, fill = false) {
  const cb = CurveBuilder.create(); build(cb);
  const pc = new PolyCurve(); pc.addCurve(cb.createCurve());
  // LineStyle.create() は VectorBrush 未実装で失敗するため createDefaultWithWeight を使う
  const def = PolyCurveNodeDefinition.create(pc, fill ? solid(rgb) : FillDescriptor.createNone(), LineStyleDescriptor.create(LineStyle.createDefaultWithWeight(weight)), solid(rgb), FillDescriptor.createNone());
  def.userDescription = name;
  doc.addNode(def);
  const n = findNode(doc, name);
  styleLine(doc, n, rgb, weight);
  if (fill) doc.setBrushFillDescriptor(solid(rgb), n);
  return n;
}

// 直交配線の角丸 (半径 r) を CurveBuilder に足す。from → corner → to の順で向きを指定
function roundedCorner(cb, corner, from, to, r) {
  const k = 0.55 * r;
  const ux = Math.sign(corner.x - from.x), uy = Math.sign(corner.y - from.y);
  const vx = Math.sign(to.x - corner.x), vy = Math.sign(to.y - corner.y);
  const p0 = { x: corner.x - ux * r, y: corner.y - uy * r };
  const p1 = { x: corner.x + vx * r, y: corner.y + vy * r };
  cb.lineTo(p0);
  cb.addBezier({ x: p0.x + ux * (r - k), y: p0.y + uy * (r - k) }, { x: p1.x - vx * (r - k), y: p1.y - vy * (r - k) }, p1);
}

// 塗りの三角の矢印ヘッド。tip が先端、len/half が大きさ。線の終点は三角の中に隠す
function addArrowHead(doc, name, tip, rgb, len = 32, half = 17) {
  return addPath(doc, name, (cb) => { cb.begin({ x: tip.x - len, y: tip.y - half }); cb.lineTo(tip); cb.lineTo({ x: tip.x - len, y: tip.y + half }); cb.close(); }, rgb, 4, true);
}

// --- テキスト・バッジ -----------------------------------------------------------

// アートテキスト。書式デルタは addText より前に適用する
function addText(doc, name, text, { family, weight = FontWeight.Bold, size = 28, rgb = [255, 255, 255] }, x, y) {
  const sb = StoryBuilder.create().setToArtisticTextDefaultStyle(doc.dpi, doc.rasterFormat);
  const deltas = [StoryDelta.createWeight(weight), StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, size), StoryDelta.createBrushFill(solid(rgb))];
  if (family) deltas.unshift(StoryDelta.createFamilyName(family));   // インストール済み名と完全一致が必要
  sb.applyGlyphDelta(StoryDelta.createComposite(deltas));
  sb.addText(text);
  const def = ArtTextNodeDefinition.createFromStoryBuilder({ x, y }, sb);
  def.userDescription = name;
  doc.addNode(def);
  return findNode(doc, name);
}

// 矩形 + 中央揃えテキストのバッジ。文字の実寸は一度描いて spreadBaseBox で測る
function addBadge(doc, name, text, { x, y, w, h, bg = [16, 16, 16], border = [138, 138, 138], fg = [228, 228, 228], family, size = 28 }) {
  const rect = ShapeNodeDefinition.create(Shape.create(ShapeType.Rectangle), new Rectangle(x, y, w, h), solid(bg), solid(border), LineStyleDescriptor.createDefault(2), FillDescriptor.createNone());
  rect.userDescription = 'chip-' + name;
  doc.addNode(rect);
  styleLine(doc, findNode(doc, 'chip-' + name), border, 2);
  const probe = addText(doc, 'probe-' + name, text, { family, size, rgb: fg }, 0, 0);
  const bb = probe.spreadBaseBox;
  doc.deleteSelection(probe);
  return addText(doc, 'label-' + name, text, { family, size, rgb: fg }, x + (w - bb.width) / 2 - bb.x, y + (h - bb.height) / 2 - bb.y);
}

// --- エフェクト・書き出し ---------------------------------------------------------

function setOuterGlow(doc, node, rgb, { radius = 30, intensity = 0.6, opacity = 0.7 } = {}) {
  const fx = OuterGlowLayerEffect.create();
  fx.radius = radius; fx.colour = RGBA8(...rgb); fx.intensity = intensity; fx.opacity = opacity; fx.enabled = true;
  doc.setOuterGlowLayerEffect(node, fx);
}

function exportPng(doc, path) {
  doc.export(path, FileExportOptions.createWithPresetName('PNG'), null, null);
}

// 例: 2400x1200 のドキュメントに背景と 1 枚の画像、線、バッジを置いて書き出す
function example() {
  const base = app.userDesktopPath + '/Work/';
  const doc = createPixelDoc(2400, 1200);
  addImage(doc, 'background', base + 'background.png', 0, 0);
  addImage(doc, 'card', base + 'card.png', 100, 400);
  addPath(doc, 'wire', (cb) => { cb.begin({ x: 900, y: 500 }); roundedCorner(cb, { x: 1200, y: 500 }, { x: 900, y: 500 }, { x: 1200, y: 700 }, 24); cb.lineTo({ x: 1200, y: 700 }); }, [138, 138, 138], 5);
  addArrowHead(doc, 'head', { x: 1300, y: 700 }, [76, 139, 245]);
  addBadge(doc, 'GUI', 'GUI', { x: 920, y: 479, w: 166, h: 42, family: 'JetBrainsMono Nerd Font' });
  doc.saveAs(base + 'work.afdesign');
  exportPng(doc, base + 'work.png');
}

module.exports = { createPixelDoc, allNodes, findNode, placeAt, moveNodes, addImage, styleLine, addPath, roundedCorner, addArrowHead, addText, addBadge, setOuterGlow, exportPng, example };
