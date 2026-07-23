// GardenScene.swift — banner.js ported: layered garden hills and the meadow scene
// where your plants stand. Day garnish (sun, clouds, birds, butterflies) and night
// garnish (stars, crescent moon, fireflies) swap with the theme. One PRNG pass in
// the web's exact draw order keeps every placement identical to the browser.
import SwiftUI

// MARK: - Scenery pieces

private func pine(_ ctx: GraphicsContext, x: Double, y: Double, h: Double, _ f: Color) {
    let w = h * 0.42
    var p1 = Path()
    p1.move(to: CGPoint(x: x, y: y - h))
    p1.addLine(to: CGPoint(x: x + w, y: y - h * 0.35))
    p1.addLine(to: CGPoint(x: x - w, y: y - h * 0.35))
    p1.closeSubpath()
    ctx.fill(p1, with: .color(f))
    var p2 = Path()
    p2.move(to: CGPoint(x: x, y: y - h * 0.72))
    p2.addLine(to: CGPoint(x: x + w * 1.25, y: y))
    p2.addLine(to: CGPoint(x: x - w * 1.25, y: y))
    p2.closeSubpath()
    ctx.fill(p2, with: .color(f))
}

private func sceneFrond(_ ctx: GraphicsContext, x: Double, y: Double, h: Double, _ f: Color) {
    var stem = Path()
    stem.move(to: CGPoint(x: x, y: y))
    stem.addLine(to: CGPoint(x: x, y: y - h))
    ctx.stroke(stem, with: .color(f), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
    for i in 0..<4 {
        let t = Double(i + 1) / 5
        let yy = y - h * t - h * 0.06
        let len = h * 0.32 * (1 - t * 0.4)
        var l = Path()
        l.move(to: CGPoint(x: x, y: yy))
        l.addQuadCurve(to: CGPoint(x: x - len, y: yy + len * 0.12), control: CGPoint(x: x - len * 0.7, y: yy - len * 0.3))
        l.move(to: CGPoint(x: x, y: yy))
        l.addQuadCurve(to: CGPoint(x: x + len, y: yy + len * 0.12), control: CGPoint(x: x + len * 0.7, y: yy - len * 0.3))
        ctx.stroke(l, with: .color(f), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
    }
    ctx.fill(Path(ellipseIn: CGRect(x: x - 2.4, y: y - h - 2.4, width: 4.8, height: 4.8)), with: .color(f))
}

private func bush(_ ctx: GraphicsContext, x: Double, y: Double, r: Double, _ f: Color) {
    ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r * 0.5 - r * 0.72, width: r * 2, height: r * 1.44)), with: .color(f))
}

/// Day: sun with soft glow rings. Night: soft glow + masked crescent moon.
private func sunOrMoon(_ ctx: GraphicsContext, x: Double, y: Double, theme: BloomTheme) {
    if theme.isDark {
        ctx.fill(Path(ellipseIn: CGRect(x: x - 34, y: y - 34, width: 68, height: 68)), with: .color(theme.hsun.opacity(0.07)))
        let full = Path(ellipseIn: CGRect(x: x - 24, y: y - 24, width: 48, height: 48))
        let bite = Path(ellipseIn: CGRect(x: x + 10 - 20, y: y - 9 - 20, width: 40, height: 40))
        ctx.fill(full.subtracting(bite), with: .color(theme.hsun))
    } else {
        ctx.fill(Path(ellipseIn: CGRect(x: x - 44, y: y - 44, width: 88, height: 88)), with: .color(theme.hsun.opacity(0.10)))
        ctx.fill(Path(ellipseIn: CGRect(x: x - 34, y: y - 34, width: 68, height: 68)), with: .color(theme.hsun.opacity(0.16)))
        ctx.fill(Path(ellipseIn: CGRect(x: x - 26, y: y - 26, width: 52, height: 52)), with: .color(theme.hsun))
    }
}

private func cloud(_ ctx: GraphicsContext, x: Double, y: Double, sc: Double, theme: BloomTheme) {
    guard !theme.isDark else { return }
    let c = theme.hcloud
    ctx.fill(Path(ellipseIn: CGRect(x: x - 26 * sc, y: y - 10 * sc, width: 52 * sc, height: 20 * sc)), with: .color(c))
    ctx.fill(Path(ellipseIn: CGRect(x: x + (17 - 15) * sc, y: y + (-6 - 8) * sc, width: 30 * sc, height: 16 * sc)), with: .color(c))
    ctx.fill(Path(ellipseIn: CGRect(x: x + (-17 - 13) * sc, y: y + (-4 - 7) * sc, width: 26 * sc, height: 14 * sc)), with: .color(c))
}

private func bird(_ ctx: GraphicsContext, x: Double, y: Double, sc: Double, theme: BloomTheme) {
    guard !theme.isDark else { return }
    var p = Path()
    p.move(to: CGPoint(x: x, y: y))
    p.addQuadCurve(to: CGPoint(x: x + 8 * sc, y: y), control: CGPoint(x: x + 4 * sc, y: y - 4 * sc))
    p.addQuadCurve(to: CGPoint(x: x + 16 * sc, y: y), control: CGPoint(x: x + 12 * sc, y: y - 4 * sc))
    ctx.stroke(p, with: .color(theme.htree1.opacity(0.55)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
}

private func butterfly(_ ctx: GraphicsContext, x: Double, y: Double, theme: BloomTheme) {
    guard !theme.isDark else { return }
    for (dx, rot) in [(-3.0, -24.0), (3.0, 24.0)] {
        let wing = Path(ellipseIn: CGRect(x: x + dx - 3.4, y: y - 0.5 - 2.3, width: 6.8, height: 4.6))
        let t = CGAffineTransform(translationX: x + dx, y: y - 0.5)
            .rotated(by: rot * .pi / 180)
            .translatedBy(x: -(x + dx), y: -(y - 0.5))
        ctx.fill(wing.applying(t), with: .color(theme.hflower.opacity(0.9)))
    }
    ctx.fill(Path(roundedRect: CGRect(x: x - 0.7, y: y - 2.4, width: 1.4, height: 4.8), cornerRadius: 0.7), with: .color(theme.htree1))
}

private func firefly(_ ctx: GraphicsContext, x: Double, y: Double, theme: BloomTheme) {
    guard theme.isDark else { return }
    let glow = Color(hex: "#E8C55B")
    ctx.fill(Path(ellipseIn: CGRect(x: x - 4, y: y - 4, width: 8, height: 8)), with: .color(glow.opacity(0.18)))
    ctx.fill(Path(ellipseIn: CGRect(x: x - 1.6, y: y - 1.6, width: 3.2, height: 3.2)), with: .color(glow.opacity(0.9)))
}

private func tuft(_ ctx: GraphicsContext, x: Double, y: Double, _ color: Color) {
    var p = Path()
    p.move(to: CGPoint(x: x, y: y))
    p.addQuadCurve(to: CGPoint(x: x - 4.5, y: y - 6.5), control: CGPoint(x: x - 2.5, y: y - 4.5))
    p.move(to: CGPoint(x: x, y: y))
    p.addLine(to: CGPoint(x: x, y: y - 8.5))
    p.move(to: CGPoint(x: x, y: y))
    p.addQuadCurve(to: CGPoint(x: x + 4.5, y: y - 6.5), control: CGPoint(x: x + 2.5, y: y - 4.5))
    ctx.stroke(p, with: .color(color.opacity(0.5)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
}

private func hillPath(_ points: [(Double, Double)], H: Double, W: Double) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: 0, y: H))
    p.addLine(to: CGPoint(x: 0, y: points[0].1))
    var i = 1
    while i + 1 < points.count {
        p.addQuadCurve(to: CGPoint(x: points[i + 1].0, y: points[i + 1].1),
                       control: CGPoint(x: points[i].0, y: points[i].1))
        i += 2
    }
    p.addLine(to: CGPoint(x: W, y: H))
    p.closeSubpath()
    return p
}

// MARK: - Empty-garden hills banner (gardenBannerSVG)

struct GardenHillsView: View {
    @Environment(\.theme) private var theme
    var seed: String = "bloom-hills-0"
    var trees: Int = 10
    var flowers: Int = 4

    var body: some View {
        Canvas { ctx, size in
            let W = 1000.0, H = 240.0
            ctx.scaleBy(x: size.width / W, y: size.height / H)
            var rnd = PlantRandom(seed: seed)

            ctx.fill(Path(CGRect(x: 0, y: 0, width: W, height: H)), with: .linearGradient(
                Gradient(colors: [theme.hsky1, theme.hsky2]),
                startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))

            // stars consume rnd even by day, like the web (CSS only hides them)
            for _ in 0..<14 {
                let x = (16 + rnd.next() * (W - 32)).rounded()
                let y = (12 + rnd.next() * 88).rounded()
                let r = 0.9 + rnd.next() * 1.1
                _ = rnd.next()   // animation delay
                if theme.isDark {
                    ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(theme.hsun))
                }
            }
            sunOrMoon(ctx, x: 872, y: 46, theme: theme)
            cloud(ctx, x: 180, y: 40, sc: 0.9, theme: theme)
            cloud(ctx, x: 560, y: 30, sc: 0.6, theme: theme)
            bird(ctx, x: 320, y: 52, sc: 0.9, theme: theme)

            let layers: [(path: Path, tree: Color, ridge: Double, hMin: Double, hMax: Double)] = [
                (hillPath([(0, 148), (120, 116), (260, 136), (400, 156), (520, 126), (640, 96), (780, 140), (890, 184), (1000, 124)], H: H, W: W), theme.htree1, 136, 22, 36),
                (hillPath([(0, 180), (150, 150), (330, 168), (510, 186), (660, 158), (810, 130), (1000, 170)], H: H, W: W), theme.htree2, 168, 20, 32),
                (hillPath([(0, 206), (200, 184), (430, 198), (660, 212), (1000, 192)], H: H, W: W), theme.htree3, 200, 16, 28),
            ]
            let fills = [theme.hill1, theme.hill2, theme.hill3]
            let perLayer = [Int(ceil(Double(trees) * 0.4)), Int(ceil(Double(trees) * 0.33)), Int(floor(Double(trees) * 0.27))]
            for (li, layer) in layers.enumerated() {
                ctx.fill(layer.path, with: .color(fills[li]))
                for _ in 0..<perLayer[li] {
                    let x = (24 + rnd.next() * (W - 48)).rounded()
                    let y = layer.ridge + 12 + rnd.next() * 12
                    let h = layer.hMin + rnd.next() * (layer.hMax - layer.hMin)
                    let kind = rnd.next()
                    if kind < 0.46 { pine(ctx, x: x, y: y, h: h, layer.tree) }
                    else if kind < 0.92 { sceneFrond(ctx, x: x, y: y, h: h, layer.tree) }
                    else { bush(ctx, x: x, y: y, r: h * 0.32, layer.tree) }
                }
            }
            for _ in 0..<flowers {
                let x = (30 + rnd.next() * (W - 60)).rounded()
                let y = 216 + rnd.next() * 16
                ctx.fill(Path(ellipseIn: CGRect(x: x - 2.6, y: y - 2.6, width: 5.2, height: 5.2)), with: .color(theme.hflower))
                ctx.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)), with: .color(theme.hsun))
            }
        }
    }
}

// MARK: - The real garden scene (gardenSceneSVG)

struct ScenePlant: Identifiable {
    var id: String { spec.id }
    var spec: PlantSpec
    var level: Int
    var name: String
}

/// Everything the scene places, computed in one PRNG pass in the web's draw order.
private struct SceneLayout {
    struct Star { var x, y, r: Double }
    struct Pine { var x, y, h: Double; var layer: Int }
    struct Placed { var plant: ScenePlant; var x, y, w: Double }
    struct Spot { var x, y: Double }

    var stars: [Star] = []
    var pines: [Pine] = []
    var tufts: [Spot] = []
    var plants: [Placed] = []
    var flowers: [Spot] = []
    var butterflies: [Spot] = []
    var fireflies: [Spot] = []

    init(scenePlants: [ScenePlant]) {
        let W = 1000.0
        var rnd = PlantRandom(seed: scenePlants.map(\.spec.id).joined())

        for _ in 0..<16 {
            let x = (16 + rnd.next() * (W - 32)).rounded()
            let y = (12 + rnd.next() * 88).rounded()
            let r = 0.9 + rnd.next() * 1.1
            _ = rnd.next()   // animation delay
            stars.append(Star(x: x, y: y, r: r))
        }
        for layer in 0..<2 {
            let ridge = layer == 0 ? 138.0 : 172.0
            for _ in 0..<4 {
                let x = (24 + rnd.next() * (W - 48)).rounded()
                let y = ridge + 10 + rnd.next() * 10
                let h = 18 + rnd.next() * 14
                pines.append(Pine(x: x, y: y, h: h, layer: layer))
            }
        }
        for _ in 0..<12 {
            let x = (14 + rnd.next() * (W - 28)).rounded()
            let y = 226 + rnd.next() * 24
            tufts.append(Spot(x: x, y: y))
        }

        // plants: tallest in the middle, fanned outward
        let sorted = scenePlants.sorted { $0.level > $1.level }
        var order: [ScenePlant] = []
        for (i, p) in sorted.enumerated() {
            if i % 2 == 0 { order.append(p) } else { order.insert(p, at: 0) }
        }
        let n = order.count
        let gap = n > 1 ? min(130, (W - 180) / Double(n - 1)) : 0
        let startX = W / 2 - gap * Double(n - 1) / 2
        var footprints: [(Double, Double)] = []
        for (i, p) in order.enumerated() {
            let w = 58 + Double(min(p.level, 12)) * 4
            let x = startX + gap * Double(i)
            let y = 240 + (rnd.next() * 10 - 5)
            footprints.append((x - w / 2 - 10, x + w / 2 + 10))
            plants.append(Placed(plant: p, x: x, y: y, w: w))
        }

        // meadow flowers steer clear of plant footprints
        let target = min(4 + n * 2, 14)
        var placedCount = 0, tries = 0
        while placedCount < target && tries < 60 {
            tries += 1
            let x = (30 + rnd.next() * (W - 60)).rounded()
            if !footprints.allSatisfy({ x < $0.0 || x > $0.1 }) { continue }
            let y = 226 + rnd.next() * 24
            flowers.append(Spot(x: x, y: y))
            placedCount += 1
        }

        butterflies.append(Spot(x: (W * 0.28 + rnd.next() * 90).rounded(), y: 176 + rnd.next() * 22))
        _ = rnd.next()   // animation delay
        butterflies.append(Spot(x: (W * 0.62 + rnd.next() * 90).rounded(), y: 168 + rnd.next() * 22))
        _ = rnd.next()
        for _ in 0..<6 {
            let x = (40 + rnd.next() * (W - 80)).rounded()
            let y = 150 + rnd.next() * 64
            _ = rnd.next()   // animation delay
            fireflies.append(Spot(x: x, y: y))
        }
    }
}

struct GardenSceneView: View {
    @Environment(\.theme) private var theme
    var plants: [ScenePlant]
    var selectedId: String?
    var onTap: (String) -> Void = { _ in }

    var body: some View {
        let layout = SceneLayout(scenePlants: plants)
        GeometryReader { geo in
            let s = geo.size.width / 1000
            ZStack(alignment: .topLeading) {
                backdrop(layout)
                ForEach(layout.plants, id: \.plant.id) { pl in
                    let h = pl.w * 1.25
                    PlantView(spec: pl.plant.spec, level: pl.plant.level)
                        .frame(width: pl.w * s, height: h * s)
                        .position(x: pl.x * s, y: (pl.y - h / 2) * s)
                        .scaleEffect(pl.plant.id == selectedId ? 1.06 : 1, anchor: .bottom)
                        .onTapGesture { onTap(pl.plant.id) }
                }
            }
        }
        .aspectRatio(1000 / 260, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func backdrop(_ layout: SceneLayout) -> some View {
        Canvas { ctx, size in
            let W = 1000.0, H = 260.0
            ctx.scaleBy(x: size.width / W, y: size.height / H)

            ctx.fill(Path(CGRect(x: 0, y: 0, width: W, height: H)), with: .linearGradient(
                Gradient(colors: [theme.hsky1, theme.hsky2]),
                startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))

            if theme.isDark {
                for st in layout.stars {
                    ctx.fill(Path(ellipseIn: CGRect(x: st.x - st.r, y: st.y - st.r, width: st.r * 2, height: st.r * 2)), with: .color(theme.hsun))
                }
            }
            sunOrMoon(ctx, x: 872, y: 46, theme: theme)
            cloud(ctx, x: 170, y: 42, sc: 1, theme: theme)
            cloud(ctx, x: 520, y: 30, sc: 0.7, theme: theme)
            cloud(ctx, x: 760, y: 62, sc: 0.55, theme: theme)
            bird(ctx, x: 300, y: 56, sc: 1, theme: theme)
            bird(ctx, x: 330, y: 48, sc: 0.7, theme: theme)

            // faraway ridge in haze, then the two familiar hill layers
            var haze = ctx
            haze.opacity = 0.45
            haze.fill(hillPath([(0, 128), (180, 104), (400, 118), (620, 132), (700, 108), (780, 84), (1000, 118)], H: H, W: W), with: .color(theme.hill1))
            let back: [(path: Path, tree: Color, fill: Color)] = [
                (hillPath([(0, 150), (120, 118), (260, 138), (400, 158), (520, 128), (640, 98), (780, 142), (890, 186), (1000, 126)], H: H, W: W), theme.htree1, theme.hill1),
                (hillPath([(0, 184), (150, 154), (330, 172), (510, 190), (660, 162), (830, 134), (1000, 174)], H: H, W: W), theme.htree2, theme.hill2),
            ]
            for (i, layer) in back.enumerated() {
                ctx.fill(layer.path, with: .color(layer.fill))
                for p in layout.pines where p.layer == i {
                    pine(ctx, x: p.x, y: p.y, h: p.h, layer.tree)
                }
            }
            ctx.fill(hillPath([(0, 218), (250, 204), (500, 212), (750, 220), (1000, 208)], H: H, W: W), with: .color(theme.hill3))
            for t in layout.tufts { tuft(ctx, x: t.x, y: t.y, theme.htree2) }
            for f in layout.flowers {
                ctx.fill(Path(ellipseIn: CGRect(x: f.x - 2.6, y: f.y - 2.6, width: 5.2, height: 5.2)), with: .color(theme.hflower))
                ctx.fill(Path(ellipseIn: CGRect(x: f.x - 1, y: f.y - 1, width: 2, height: 2)), with: .color(theme.hsun))
            }
            for b in layout.butterflies { butterfly(ctx, x: b.x, y: b.y, theme: theme) }
            for f in layout.fireflies { firefly(ctx, x: f.x, y: f.y, theme: theme) }
        }
    }
}
