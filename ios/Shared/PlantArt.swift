// PlantArt.swift — chunky kawaii potted plants, five species, parametric by level.
// A faithful Canvas port of plant.js: same seeded PRNG, same geometry, so a plant
// looks identical here and on the web. Shared with the widget extension.
import SwiftUI

struct PlantSpec {
    var id: String
    var colorHex: String
    /// nil = species never picked. Kept raw because the web PRNG seed is
    /// `id + (species || '')` — an explicit "bloom" seeds differently than absent.
    var speciesRaw: String?

    var species: String { speciesRaw ?? "bloom" }
    var seed: String { id + (speciesRaw ?? "") }

    init(id: String, colorHex: String, species: String? = nil) {
        self.id = id
        self.colorHex = colorHex
        self.speciesRaw = species
    }
}

let PLANT_SPECIES: [(key: String, label: String)] = [
    ("bloom", "Bloom"),
    ("sunflower", "Sunflower"),
    ("cactus", "Cactus"),
    ("fern", "Fern"),
    ("bonsai", "Bonsai"),
]

// MARK: - Color helpers (shared with the widget)

extension Color {
    /// "#C97F5F" → Color. Falls back to olive on bad input.
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        var v: UInt64 = 0
        guard h.count == 6, Scanner(string: h).scanHexInt64(&v) else {
            self = Color(red: 0.49, green: 0.55, blue: 0.31); return
        }
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

/// util.js shade(hex, pct): pct>0 toward white, pct<0 toward black.
func shade(_ hex: String, _ pct: Double) -> Color {
    var h = hex
    if h.hasPrefix("#") { h.removeFirst() }
    var v: UInt64 = 0
    guard h.count == 6, Scanner(string: h).scanHexInt64(&v) else { return Color(hex: hex) }
    var r = Double((v >> 16) & 255), g = Double((v >> 8) & 255), b = Double(v & 255)
    let t: Double = pct < 0 ? 0 : 255
    let p = abs(pct) / 100
    r = (r + (t - r) * p).rounded(); g = (g + (t - g) * p).rounded(); b = (b + (t - b) * p).rounded()
    return Color(red: r / 255, green: g / 255, blue: b / 255)
}

/// CSS hsl(h, s%, l%) → Color.
func hsl(_ h: Double, _ s: Double, _ l: Double) -> Color {
    let sat = s / 100, lig = l / 100
    let c = (1 - abs(2 * lig - 1)) * sat
    let hp = h.truncatingRemainder(dividingBy: 360) / 60
    let x = c * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
    let (r1, g1, b1): (Double, Double, Double)
    switch hp {
    case ..<1: (r1, g1, b1) = (c, x, 0)
    case ..<2: (r1, g1, b1) = (x, c, 0)
    case ..<3: (r1, g1, b1) = (0, c, x)
    case ..<4: (r1, g1, b1) = (0, x, c)
    case ..<5: (r1, g1, b1) = (x, 0, c)
    default: (r1, g1, b1) = (c, 0, x)
    }
    let m = lig - c / 2
    return Color(red: r1 + m, green: g1 + m, blue: b1 + m)
}

// MARK: - The web's seeded PRNG, bit-for-bit

/// plant.js srand — MUST run in Double arithmetic: the JS original overflows 2^53
/// during `s * 1103515245`, and float64 rounding is part of the observable sequence.
struct PlantRandom {
    private var s: Double

    init(seed: String) {
        var acc: Double = 7
        for u in seed.utf16 {
            acc = (acc * 31 + Double(u)).truncatingRemainder(dividingBy: 1e9)
        }
        s = acc
    }

    mutating func next() -> Double {
        s = (s * 1103515245 + 12345).truncatingRemainder(dividingBy: 2147483648)
        return s / 2147483648
    }
}

// MARK: - Painter

private let CX = 60.0
private let SOIL = 102.0

/// Draws into the 120×150 viewBox of plant.js. The caller scales the context.
struct PlantPainter {
    let spec: PlantSpec
    let level: Int

    var seededLevel: Int { max(1, min(level, 12)) }

    // MARK: shared bits

    private func strokePath(_ ctx: GraphicsContext, _ p: Path, _ color: Color, _ width: Double) {
        ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
    }

    /// v2: plump two-tone leaf, tip lifted, no vein, soft top-lit gradient.
    /// hue/light are still taken (and still cost PRNG calls) for web parity.
    private func leaf(_ ctx: GraphicsContext, x: Double, y: Double, len: Double, ang: Double, hue: Double, light: Double) {
        _ = (hue, light)
        let w = len * 0.6
        let rot = CGAffineTransform(translationX: x, y: y)
            .rotated(by: ang * .pi / 180)
            .translatedBy(x: -x, y: -y)
        var body = Path()
        body.move(to: CGPoint(x: x, y: y))
        body.addCurve(to: CGPoint(x: x + len, y: y - len * 0.1),
                      control1: CGPoint(x: x + len * 0.12, y: y - w * 0.8),
                      control2: CGPoint(x: x + len * 0.72, y: y - w * 0.62))
        body.addCurve(to: CGPoint(x: x, y: y),
                      control1: CGPoint(x: x + len * 0.74, y: y + w * 0.42),
                      control2: CGPoint(x: x + len * 0.16, y: y + w * 0.5))
        body.closeSubpath()
        // linearGradient (0,0)→(0.3,1) in the leaf's own box, rotated with it
        let start = CGPoint(x: x, y: y - w * 0.8).applying(rot)
        let end = CGPoint(x: x + len * 0.3, y: y + w * 0.5).applying(rot)
        ctx.fill(body.applying(rot), with: .linearGradient(
            Gradient(colors: [Color(hex: "#AED580"), Color(hex: "#5FA054")]),
            startPoint: start, endPoint: end))
    }

    /// v2: outline-free petals, soft glow halo, radial-lit golden center.
    private func flower(_ ctx: GraphicsContext, x: Double, y: Double, r: Double, color: String) {
        for i in 0..<6 {
            let a = Double(i) / 6 * .pi * 2 + 0.5
            let px = x + cos(a) * r * 0.95, py = y + sin(a) * r * 0.95
            let petal = Path(ellipseIn: CGRect(x: px - r * 0.62, y: py - r * 0.62, width: r * 1.24, height: r * 1.24))
            ctx.fill(petal, with: .color(shade(color, 6)))
        }
        let glow = Path(ellipseIn: CGRect(x: x - r * 0.95, y: y - r * 0.95, width: r * 1.9, height: r * 1.9))
        ctx.fill(glow, with: .color(shade(color, 30).opacity(0.45)))
        let cr = r * 0.55
        let center = Path(ellipseIn: CGRect(x: x - cr, y: y - cr, width: cr * 2, height: cr * 2))
        ctx.fill(center, with: .radialGradient(
            Gradient(colors: [Color(hex: "#FFE68F"), Color(hex: "#EFAE3B")]),
            center: CGPoint(x: x - cr + 0.4 * cr * 2, y: y - cr + 0.35 * cr * 2),
            startRadius: 0, endRadius: cr * 1.8))
        let glint = Path(ellipseIn: CGRect(x: x - r * 0.17 - r * 0.16, y: y - r * 0.19 - r * 0.16, width: r * 0.32, height: r * 0.32))
        ctx.fill(glint, with: .color(Color(red: 1, green: 250 / 255, blue: 225 / 255).opacity(0.9)))
    }

    /// v2: glossy egg bud with a tilted highlight.
    private func bud(_ ctx: GraphicsContext, x: Double, y: Double, r: Double, color: String) {
        let egg = Path(ellipseIn: CGRect(x: x - r * 0.86, y: y - r, width: r * 1.72, height: r * 2))
        ctx.fill(egg, with: .radialGradient(
            Gradient(colors: [shade(color, 36), shade(color, -4)]),
            center: CGPoint(x: x - r * 0.86 + 0.36 * r * 1.72, y: y - r + 0.3 * r * 2),
            startRadius: 0, endRadius: r * 1.75))
        let hx = x - r * 0.3, hy = y - r * 0.38
        let hl = Path(ellipseIn: CGRect(x: hx - r * 0.3, y: hy - r * 0.22, width: r * 0.6, height: r * 0.44))
        let rot = CGAffineTransform(translationX: hx, y: hy).rotated(by: -24 * .pi / 180).translatedBy(x: -hx, y: -hy)
        ctx.fill(hl.applying(rot), with: .color(Color(red: 1, green: 252 / 255, blue: 240 / 255).opacity(0.75)))
    }

    private func sparkle(_ ctx: GraphicsContext, x: Double, y: Double, r: Double) {
        var p = Path()
        p.move(to: CGPoint(x: x, y: y - r))
        p.addQuadCurve(to: CGPoint(x: x + r, y: y), control: CGPoint(x: x + r * 0.18, y: y - r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x, y: y + r), control: CGPoint(x: x + r * 0.18, y: y + r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x - r, y: y), control: CGPoint(x: x - r * 0.18, y: y + r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x, y: y - r), control: CGPoint(x: x - r * 0.18, y: y - r * 0.18))
        p.closeSubpath()
        ctx.fill(p, with: .color(Color(hex: "#F2C14E")))
    }

    private func sparkles(_ ctx: GraphicsContext, topX: Double, topY: Double, L: Int) {
        guard L >= 12 else { return }
        sparkle(ctx, x: topX - 21, y: topY + 2, r: 3.4)
        sparkle(ctx, x: topX + 19, y: topY - 6, r: 2.8)
        sparkle(ctx, x: topX + 3, y: topY - 18, r: 3.8)
    }

    // MARK: species

    private func drawBloom(_ ctx: GraphicsContext, _ L: Int, _ c: String, _ rnd: inout PlantRandom) {
        let h = L == 1 ? 9.0 : min(14 + Double(L) * 5.2, 76)
        let lean = (rnd.next() - 0.5) * 5
        let topX = CX + lean, topY = SOIL - h
        let stemCol = Color(hex: "#55A86C")

        if L >= 2 {
            var stem = Path()
            stem.move(to: CGPoint(x: CX, y: SOIL))
            stem.addCurve(to: CGPoint(x: topX, y: topY),
                          control1: CGPoint(x: CX, y: SOIL - h * 0.45),
                          control2: CGPoint(x: topX, y: SOIL - h * 0.6))
            strokePath(ctx, stem, stemCol, L >= 7 ? 6 : 5)
        }
        if L >= 9 {
            let sy = SOIL - h * 0.52
            var p = Path()
            p.move(to: CGPoint(x: CX - 1, y: sy))
            p.addQuadCurve(to: CGPoint(x: CX - 19, y: sy - 13), control: CGPoint(x: CX - 13, y: sy - 6))
            strokePath(ctx, p, stemCol, 4)
            flower(ctx, x: CX - 19, y: sy - 15, r: 6.4, color: c)
        }
        if L >= 10 {
            let sy = SOIL - h * 0.34
            var p = Path()
            p.move(to: CGPoint(x: CX + 1, y: sy))
            p.addQuadCurve(to: CGPoint(x: CX + 19, y: sy - 10), control: CGPoint(x: CX + 13, y: sy - 4))
            strokePath(ctx, p, stemCol, 4)
            flower(ctx, x: CX + 19, y: sy - 12, r: 5.6, color: c)
        }
        if L == 1 {
            var stem = Path()
            stem.move(to: CGPoint(x: CX, y: SOIL))
            stem.addLine(to: CGPoint(x: CX, y: SOIL - 9))
            strokePath(ctx, stem, stemCol, 4.5)
            leaf(ctx, x: CX, y: SOIL - 8, len: 13, ang: -148, hue: 103, light: 44)
            leaf(ctx, x: CX, y: SOIL - 8, len: 13, ang: -32, hue: 112, light: 40)
        } else {
            let pairs = min(1 + Int(Double(L) / 2.6), 4)
            for i in 0..<pairs {
                let t = 0.78 - Double(i) * 0.2
                let y = SOIL - h * t
                let x = CX + lean * (1 - t) * 0.6
                let len = min(12 + Double(L) * 1.15, 24) * (1 - Double(i) * 0.12)
                leaf(ctx, x: x, y: y, len: len, ang: 180 + 34 + rnd.next() * 8, hue: 100 + rnd.next() * 18, light: 42 + rnd.next() * 6)
                leaf(ctx, x: x, y: y, len: len, ang: -(34 + rnd.next() * 8), hue: 100 + rnd.next() * 18, light: 42 + rnd.next() * 6)
            }
        }
        if L >= 3 && L < 7 { bud(ctx, x: topX, y: topY - 2, r: 4.2 + Double(L - 3) * 1.1, color: c) }
        if L >= 7 { flower(ctx, x: topX, y: topY - 3, r: 8 + Double(L - 7) * 0.9, color: c) }
        sparkles(ctx, topX: topX, topY: topY, L: L)
    }

    private func drawCactus(_ ctx: GraphicsContext, _ L: Int, _ c: String, _ rnd: inout PlantRandom) {
        let green = Color(hex: "#74A876"), dark = Color(hex: "#5F9161")
        let h = min(12 + Double(L) * 5, 66)
        let w = 15 + min(Double(L) * 0.9, 7)
        let top = SOIL - h

        if L == 1 {
            ctx.fill(Path(ellipseIn: CGRect(x: CX - 8.5, y: SOIL - 6 - 8, width: 17, height: 16)), with: .color(green))
            var p = Path()
            p.move(to: CGPoint(x: CX - 3, y: SOIL - 9)); p.addLine(to: CGPoint(x: CX - 3, y: SOIL - 6))
            p.move(to: CGPoint(x: CX + 3, y: SOIL - 10)); p.addLine(to: CGPoint(x: CX + 3, y: SOIL - 7))
            strokePath(ctx, p, dark, 1.4)
            return
        }
        // body
        ctx.fill(Path(roundedRect: CGRect(x: CX - w / 2, y: top, width: w, height: h + 4), cornerRadius: w / 2), with: .color(green))
        var ribs = Path()
        ribs.move(to: CGPoint(x: CX, y: top + 5)); ribs.addLine(to: CGPoint(x: CX, y: SOIL))
        ribs.move(to: CGPoint(x: CX - w / 4, y: top + 8)); ribs.addLine(to: CGPoint(x: CX - w / 4, y: SOIL))
        ribs.move(to: CGPoint(x: CX + w / 4, y: top + 8)); ribs.addLine(to: CGPoint(x: CX + w / 4, y: SOIL))
        strokePath(ctx, ribs, dark, 1.5)
        // freckle spines
        for _ in 0..<min(L * 2, 14) {
            let sx = CX - w / 2 + 3 + rnd.next() * (w - 6)
            let sy = top + 6 + rnd.next() * (h - 8)
            ctx.fill(Path(ellipseIn: CGRect(x: sx - 0.9, y: sy - 0.9, width: 1.8, height: 1.8)), with: .color(Color(hex: "#EAF2DC")))
        }
        // arms
        if L >= 4 {
            let ay = top + h * 0.42
            var p = Path()
            p.move(to: CGPoint(x: CX - w / 2, y: ay + 4))
            p.addLine(to: CGPoint(x: CX - w / 2 - 8, y: ay + 4))
            p.addArc(tangent1End: CGPoint(x: CX - w / 2 - 13, y: ay + 4), tangent2End: CGPoint(x: CX - w / 2 - 13, y: ay - 1), radius: 5)
            p.addLine(to: CGPoint(x: CX - w / 2 - 13, y: ay - 10))
            strokePath(ctx, p, green, 9)
        }
        if L >= 7 {
            let ay = top + h * 0.24
            var p = Path()
            p.move(to: CGPoint(x: CX + w / 2, y: ay + 4))
            p.addLine(to: CGPoint(x: CX + w / 2 + 7, y: ay + 4))
            p.addArc(tangent1End: CGPoint(x: CX + w / 2 + 12, y: ay + 4), tangent2End: CGPoint(x: CX + w / 2 + 12, y: ay - 1), radius: 5)
            p.addLine(to: CGPoint(x: CX + w / 2 + 12, y: ay - 12))
            strokePath(ctx, p, green, 9)
        }
        if L >= 5 && L < 8 { bud(ctx, x: CX, y: top - 2, r: 3.6 + Double(L - 5), color: c) }
        if L >= 8 { flower(ctx, x: CX, y: top - 4, r: 6.5 + Double(L - 8) * 0.8, color: c) }
        sparkles(ctx, topX: CX, topY: top, L: L)
    }

    private func frond(_ ctx: GraphicsContext, x0: Double, y0: Double, ang: Double, len: Double, hue: Double, light: Double) {
        let rad = ang * .pi / 180
        let tipX = x0 + cos(rad) * len
        let tipY = y0 - sin(rad) * len
        let ctrlX = x0 + cos(rad) * len * 0.5 - sin(rad) * len * 0.22
        let ctrlY = y0 - sin(rad) * len * 0.5 - cos(rad) * len * 0.22
        let col = hsl(hue, 46, light)
        var stem = Path()
        stem.move(to: CGPoint(x: x0, y: y0))
        stem.addQuadCurve(to: CGPoint(x: tipX, y: tipY), control: CGPoint(x: ctrlX, y: ctrlY))
        strokePath(ctx, stem, col, 2.4)
        var t = 0.2
        while t < 0.95 {
            let mt = 1 - t
            let px = mt * mt * x0 + 2 * mt * t * ctrlX + t * t * tipX
            let py = mt * mt * y0 + 2 * mt * t * ctrlY + t * t * tipY
            let ll = 6.5 * (1 - t * 0.72)
            var p = Path()
            p.move(to: CGPoint(x: px, y: py)); p.addLine(to: CGPoint(x: px - ll * 0.8, y: py - ll * 0.6))
            p.move(to: CGPoint(x: px, y: py)); p.addLine(to: CGPoint(x: px + ll * 0.8, y: py - ll * 0.5))
            strokePath(ctx, p, col, 1.7)
            t += 0.14
        }
    }

    private func drawFern(_ ctx: GraphicsContext, _ L: Int, _ c: String, _ rnd: inout PlantRandom) {
        let n = min(2 + L, 11)
        for i in 0..<n {
            let spread = n == 1 ? 90 : 38 + (Double(i) / Double(n - 1)) * 104
            let len = min(16 + Double(L) * 4.2, 62) * (0.62 + rnd.next() * 0.38)
            frond(ctx, x0: CX, y0: SOIL, ang: spread, len: len, hue: 100 + rnd.next() * 24, light: 34 + rnd.next() * 10)
        }
        if L >= 9 {
            // a young curled fiddlehead: q2 -14 8 -18 then a small arc hook
            var p = Path()
            p.move(to: CGPoint(x: CX + 4, y: SOIL))
            p.addQuadCurve(to: CGPoint(x: CX + 12, y: SOIL - 18), control: CGPoint(x: CX + 6, y: SOIL - 14))
            p.addArc(center: CGPoint(x: CX + 14, y: SOIL - 15.8), radius: 3,
                     startAngle: .degrees(228), endAngle: .degrees(70), clockwise: false)
            strokePath(ctx, p, Color(hex: "#7FB268"), 2.6)
        }
        if L >= 11 { bud(ctx, x: CX - 14, y: SOIL - min(16 + Double(L) * 4.2, 62) * 0.72, r: 3.4, color: c) }
        sparkles(ctx, topX: CX, topY: SOIL - min(16 + Double(L) * 4.2, 62), L: L)
    }

    private func drawBonsai(_ ctx: GraphicsContext, _ L: Int, _ c: String, _ rnd: inout PlantRandom) {
        let h = min(12 + Double(L) * 4.2, 58)
        let trunk = Color(hex: "#8A6844")
        let top = SOIL - h
        var t = Path()
        t.move(to: CGPoint(x: CX, y: SOIL))
        t.addCurve(to: CGPoint(x: CX + 2, y: top + 6),
                   control1: CGPoint(x: CX - 9, y: SOIL - h * 0.35),
                   control2: CGPoint(x: CX + 11, y: SOIL - h * 0.55))
        strokePath(ctx, t, trunk, 5 + min(Double(L) * 0.3, 2.4))
        if L >= 5 {
            var b = Path()
            b.move(to: CGPoint(x: CX + 2, y: SOIL - h * 0.55))
            b.addQuadCurve(to: CGPoint(x: CX + 2 - 18, y: SOIL - h * 0.55 - 9), control: CGPoint(x: CX + 2 - 12, y: SOIL - h * 0.55 - 3))
            strokePath(ctx, b, trunk, 4)
        }
        func cloud(_ x: Double, _ y: Double, _ r: Double, _ tone: Color) {
            ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r * 0.62, width: r * 2, height: r * 1.24)), with: .color(tone))
            ctx.fill(Path(ellipseIn: CGRect(x: x - r * 0.55 - r * 0.6, y: y + r * 0.18 - r * 0.42, width: r * 1.2, height: r * 0.84)), with: .color(tone))
            ctx.fill(Path(ellipseIn: CGRect(x: x + r * 0.55 - r * 0.62, y: y + r * 0.2 - r * 0.44, width: r * 1.24, height: r * 0.88)), with: .color(tone))
            ctx.fill(Path(ellipseIn: CGRect(x: x - r * 0.2 - r * 0.5, y: y - r * 0.28 - r * 0.36, width: r, height: r * 0.72)), with: .color(Color(hex: "#5E8C54")))
        }
        let clouds = min(1 + L / 3, 4)
        let spots: [(Double, Double, Double)] = [
            (CX + 2, top + 2, 13 + min(Double(L), 6)),
            (CX - 17, SOIL - h * 0.62, 9 + min(Double(L) * 0.6, 4)),
            (CX + 17, SOIL - h * 0.78, 8.5 + min(Double(L) * 0.5, 4)),
            (CX - 8, top + 10, 7.5),
        ]
        for i in 0..<clouds { cloud(spots[i].0, spots[i].1, spots[i].2, Color(hex: "#4E7A46")) }
        if L >= 8 {
            for i in 0..<min(3 + L - 8, 7) {
                let sp = spots[i % clouds]
                let bx = sp.0 - sp.2 * 0.7 + rnd.next() * sp.2 * 1.4
                let by = sp.1 - 2 + rnd.next() * 5
                let blossom = Path(ellipseIn: CGRect(x: bx - 1.7, y: by - 1.7, width: 3.4, height: 3.4))
                ctx.fill(blossom, with: .color(shade(c, 26)))
                ctx.stroke(blossom, with: .color(shade(c, -6)), lineWidth: 0.6)
            }
        }
        sparkles(ctx, topX: CX + 2, topY: top, L: L)
    }

    private func drawSunflower(_ ctx: GraphicsContext, _ L: Int, _ c: String, _ rnd: inout PlantRandom) {
        let h = min(16 + Double(L) * 5.8, 82)
        let lean = (rnd.next() - 0.5) * 4
        let topX = CX + lean, topY = SOIL - h
        let stemCol = Color(hex: "#4E9159")
        var stem = Path()
        stem.move(to: CGPoint(x: CX, y: SOIL))
        stem.addCurve(to: CGPoint(x: topX, y: topY + 4),
                      control1: CGPoint(x: CX, y: SOIL - h * 0.5),
                      control2: CGPoint(x: topX, y: SOIL - h * 0.65))
        strokePath(ctx, stem, stemCol, L >= 6 ? 5.5 : 4.5)
        let pairs = min(1 + Int(Double(L) / 3.5), 3)
        for i in 0..<pairs {
            let t = 0.62 - Double(i) * 0.22
            let y = SOIL - h * t
            let len = min(13 + Double(L) * 1.2, 25) * (1 - Double(i) * 0.15)
            leaf(ctx, x: CX, y: y, len: len, ang: 180 + 32, hue: 105, light: 40)
            leaf(ctx, x: CX, y: y, len: len, ang: -32, hue: 112, light: 43)
        }
        if L < 4 {
            bud(ctx, x: topX, y: topY, r: 4 + Double(L), color: "#7FB268")
        } else {
            let r = L < 7 ? 5 + Double(L) : min(10 + Double(L - 7) * 1.5, 17)
            let petals = L < 7 ? 8 : 12
            for i in 0..<petals {
                let a = Double(i) / Double(petals) * .pi * 2
                let px = topX + cos(a) * r, py = topY + sin(a) * r
                let petal = Path(ellipseIn: CGRect(x: px - r * 0.52, y: py - r * 0.26, width: r * 1.04, height: r * 0.52))
                let rot = CGAffineTransform(translationX: px, y: py).rotated(by: a).translatedBy(x: -px, y: -py)
                let rotated = petal.applying(rot)
                ctx.fill(rotated, with: .color(Color(hex: "#EDB93E")))
                ctx.stroke(rotated, with: .color(Color(hex: "#D69E2B")), lineWidth: 0.8)
            }
            let face = Path(ellipseIn: CGRect(x: topX - r * 0.62, y: topY - r * 0.62, width: r * 1.24, height: r * 1.24))
            ctx.fill(face, with: .color(Color(hex: "#7A5238")))
            ctx.stroke(face, with: .color(Color(hex: "#5E3E2A")), lineWidth: 1.2)
            for _ in 0..<min(L, 9) {
                let sx = topX - r * 0.34 + rnd.next() * r * 0.68
                let sy = topY - r * 0.3 + rnd.next() * r * 0.6
                ctx.fill(Path(ellipseIn: CGRect(x: sx - 1, y: sy - 1, width: 2, height: 2)), with: .color(Color(hex: "#5E3E2A")))
            }
        }
        if L >= 11 { flower(ctx, x: CX - 18, y: SOIL - h * 0.4, r: 5, color: c) }
        sparkles(ctx, topX: topX, topY: topY, L: L)
    }

    // MARK: pot + full draw

    func drawGreen(_ ctx: GraphicsContext) {
        var rnd = PlantRandom(seed: spec.seed)
        let L = seededLevel
        switch spec.species {
        case "cactus": drawCactus(ctx, L, spec.colorHex, &rnd)
        case "fern": drawFern(ctx, L, spec.colorHex, &rnd)
        case "bonsai": drawBonsai(ctx, L, spec.colorHex, &rnd)
        case "sunflower": drawSunflower(ctx, L, spec.colorHex, &rnd)
        default: drawBloom(ctx, L, spec.colorHex, &rnd)
        }
    }

    /// v2 pot: gradient body with a glossy edge stroke, gradient rim, simple face.
    func drawPot(_ ctx: GraphicsContext) {
        let c = spec.colorHex
        let potTop = SOIL + 4

        // soil + a moist glint
        ctx.fill(Path(ellipseIn: CGRect(x: 60 - 16, y: SOIL + 1 - 3.6, width: 32, height: 7.2)), with: .color(Color(hex: "#6E5138")))
        ctx.fill(Path(ellipseIn: CGRect(x: 55 - 5, y: SOIL - 1.6, width: 10, height: 3.2)), with: .color(.white.opacity(0.12)))

        // body with vertical gradient
        var body = Path()
        body.move(to: CGPoint(x: 42, y: potTop + 7))
        body.addLine(to: CGPoint(x: 45, y: potTop + 30))
        body.addQuadCurve(to: CGPoint(x: 51, y: potTop + 34), control: CGPoint(x: 45, y: potTop + 34))
        body.addLine(to: CGPoint(x: 69, y: potTop + 34))
        body.addQuadCurve(to: CGPoint(x: 75, y: potTop + 30), control: CGPoint(x: 75, y: potTop + 34))
        body.addLine(to: CGPoint(x: 78, y: potTop + 7))
        body.closeSubpath()
        ctx.fill(body, with: .linearGradient(
            Gradient(colors: [shade(c, 20), shade(c, -14)]),
            startPoint: CGPoint(x: 60, y: potTop + 7),
            endPoint: CGPoint(x: 60, y: potTop + 34)
        ))

        // glossy edge light
        var gloss = Path()
        gloss.move(to: CGPoint(x: 47, y: potTop + 10))
        gloss.addQuadCurve(to: CGPoint(x: 48.8, y: potTop + 28), control: CGPoint(x: 46.4, y: potTop + 20))
        strokePath(ctx, gloss, Color(red: 1, green: 253 / 255, blue: 244 / 255).opacity(0.4), 4)

        // rim: gradient band + soft shadow under it
        ctx.fill(Path(roundedRect: CGRect(x: 38, y: potTop - 3, width: 44, height: 11), cornerRadius: 5.5), with: .linearGradient(
            Gradient(colors: [shade(c, 30), shade(c, 2)]),
            startPoint: CGPoint(x: 60, y: potTop - 3),
            endPoint: CGPoint(x: 60, y: potTop + 8)
        ))
        ctx.fill(Path(roundedRect: CGRect(x: 40, y: potTop + 6, width: 40, height: 2.2), cornerRadius: 1.1),
                 with: .color(Color(red: 60 / 255, green: 40 / 255, blue: 25 / 255).opacity(0.14)))

        // face
        let ink = Color(red: 56 / 255, green: 40 / 255, blue: 30 / 255).opacity(0.78)
        ctx.fill(Path(ellipseIn: CGRect(x: 53.5 - 1.9, y: potTop + 18 - 1.9, width: 3.8, height: 3.8)), with: .color(ink))
        ctx.fill(Path(ellipseIn: CGRect(x: 66.5 - 1.9, y: potTop + 18 - 1.9, width: 3.8, height: 3.8)), with: .color(ink))
        var smile = Path()
        smile.move(to: CGPoint(x: 56, y: potTop + 22.5))
        smile.addQuadCurve(to: CGPoint(x: 64, y: potTop + 22.5), control: CGPoint(x: 60, y: potTop + 26))
        strokePath(ctx, smile, ink, 1.9)
    }

    func drawShadow(_ ctx: GraphicsContext) {
        ctx.fill(Path(ellipseIn: CGRect(x: 60 - 26, y: 145 - 4, width: 52, height: 8)),
                 with: .color(Color(red: 46 / 255, green: 67 / 255, blue: 105 / 255).opacity(0.10)))
    }
}

/// Rough top of the drawn art (viewBox y) so views can crop empty sky above the plant.
func plantArtTop(species: String, level: Int) -> Double {
    let L = Double(max(1, min(level, 12)))
    let li = max(1, min(level, 12))
    var top: Double
    switch species {
    case "cactus":
        top = SOIL - min(12 + L * 5, 66)
        if li >= 8 { top -= (6.5 + Double(li - 8) * 0.8) * 1.7 + 4 } else if li >= 5 { top -= (3.6 + Double(li - 5)) * 2 + 2 }
    case "fern":
        top = SOIL - min(16 + L * 4.2, 62)
    case "bonsai":
        let h = min(12 + L * 4.2, 58)
        top = SOIL - h + 2 - (13 + min(L, 6)) * 0.62 - 6
    case "sunflower":
        let h = min(16 + L * 5.8, 82)
        let r = li < 4 ? 4 + L : (li < 7 ? 5 + L : min(10 + Double(li - 7) * 1.5, 17))
        top = SOIL - h - r * 1.05
    default:
        let h = li == 1 ? 9 : min(14 + L * 5.2, 76)
        top = SOIL - h
        if li >= 7 { top -= (8 + Double(li - 7) * 0.9) * 1.6 + 3 } else if li >= 3 { top -= (4.2 + Double(li - 3) * 1.1) + 2 }
    }
    if li >= 12 { top -= 22 }   // sparkles float above the crown
    return max(0, top - 4)
}

// MARK: - SwiftUI views

/// The full potted plant, drawn in the 120×150 viewBox and scaled to fit.
/// `sway` gently rocks the green part around the soil, like the web's CSS animation.
struct PlantView: View {
    var spec: PlantSpec
    var level: Int
    var sway: Bool = false
    @State private var swaying = false

    var body: some View {
        Canvas { ctx, size in
            let painter = PlantPainter(spec: spec, level: level)
            ctx.scaleBy(x: size.width / 120, y: size.height / 150)
            painter.drawShadow(ctx)
            if !sway { painter.drawGreen(ctx) }
            painter.drawPot(ctx)
        }
        .overlay {
            if sway {
                Canvas { ctx, size in
                    let painter = PlantPainter(spec: spec, level: level)
                    ctx.scaleBy(x: size.width / 120, y: size.height / 150)
                    painter.drawGreen(ctx)
                }
                .rotationEffect(.degrees(swaying ? 1.4 : -1.4), anchor: UnitPoint(x: 0.5, y: SOIL / 150))
                .onAppear {
                    withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) {
                        swaying = true
                    }
                }
            }
        }
        .aspectRatio(120 / 150, contentMode: .fit)
    }
}

/// Plant art with the empty sky cropped off — for tight layouts (garden peek, zen).
struct CroppedPlantView: View {
    var spec: PlantSpec
    var level: Int
    var width: Double

    var body: some View {
        let top = plantArtTop(species: spec.species, level: level)
        let visibleH = 150 - top
        let scale = width / 120
        PlantView(spec: spec, level: level)
            .frame(width: width, height: 150 * scale)
            .offset(y: -top * scale)
            .frame(width: width, height: visibleH * scale, alignment: .top)
            .clipped()
    }
}
