// icongen — renders the Bloom app icon from the app's own PlantPainter art,
// so the icon always matches the in-app plant style. Regenerate after art changes:
//
//   cd ios/tools/icongen
//   xcrun swiftc -parse-as-library -O -target arm64-apple-macos14.0 \
//       main.swift ../../Shared/PlantArt.swift -o icongen
//   ./icongen bloom 12 light  ../../Bloom/Assets.xcassets/AppIcon.appiconset/AppIcon.png       900
//   ./icongen bloom 12 dark   ../../Bloom/Assets.xcassets/AppIcon.appiconset/AppIcon-Dark.png  900
//   # tinted = grayscale of the dark one:
//   python3 -c "from PIL import Image, ImageOps; p='../../Bloom/Assets.xcassets/AppIcon.appiconset/'; \
//       ImageOps.autocontrast(Image.open(p+'AppIcon-Dark.png').convert('L')).convert('RGB').save(p+'AppIcon-Tinted.png')"
//
// Usage: icongen <species> <level> <light|dark> <out.png> [plantH]
import SwiftUI
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics
import Foundation

struct IconView: View {
    var species: String
    var level: Int
    var dark: Bool
    var plantH: CGFloat

    var body: some View {
        Canvas { ctx, size in
            let W = size.width, H = size.height
            let spec = PlantSpec(id: "icon-\(species)", colorHex: "#C97F5F", species: species)
            let painter = PlantPainter(spec: spec, level: level)

            // ---- sky
            let skyRect = Path(CGRect(origin: .zero, size: size))
            if dark {
                ctx.fill(skyRect, with: .linearGradient(
                    Gradient(colors: [Color(hex: "#26231E"), Color(hex: "#161513")]),
                    startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))
            } else {
                ctx.fill(skyRect, with: .linearGradient(
                    Gradient(colors: [Color(hex: "#FAF6E6"), Color(hex: "#EFEBD2")]),
                    startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))
            }

            // plant geometry (needed to aim the glow at the flower head)
            let s = plantH / 150
            let x0 = (W - 120 * s) / 2
            let groundY = H * 0.865
            let y0 = groundY - 140 * s
            let headY = y0 + (150 - plantHeadFromSoil(species: species, level: level)) / 150 * plantH

            if dark {
                // moon (crescent) top-right + soft glow + stars
                let mx = W * 0.79, my = H * 0.185, mr = W * 0.075
                let glow = Path(ellipseIn: CGRect(x: mx - mr * 2.6, y: my - mr * 2.6, width: mr * 5.2, height: mr * 5.2))
                ctx.fill(glow, with: .radialGradient(
                    Gradient(colors: [Color(hex: "#E9E3CD").opacity(0.16), .clear]),
                    center: CGPoint(x: mx, y: my), startRadius: 0, endRadius: mr * 2.6))
                let disc = Path(ellipseIn: CGRect(x: mx - mr, y: my - mr, width: mr * 2, height: mr * 2))
                let bite = Path(ellipseIn: CGRect(x: mx - mr + mr * 0.52, y: my - mr - mr * 0.3, width: mr * 2, height: mr * 2))
                ctx.fill(disc.subtracting(bite), with: .color(Color(hex: "#E9E3CD")))
                // stars: mix of dots and tiny 4-point sparkles
                let starCol = Color(hex: "#E9E3CD")
                for (sx, sy, r) in [(0.16, 0.14, 7.0), (0.30, 0.26, 5.0), (0.10, 0.36, 5.5), (0.58, 0.10, 5.0), (0.88, 0.42, 5.5), (0.68, 0.30, 4.5)] {
                    ctx.fill(Path(ellipseIn: CGRect(x: W * sx - r, y: H * sy - r, width: r * 2, height: r * 2)),
                             with: .color(starCol.opacity(0.75)))
                }
                for (sx, sy, r) in [(0.22, 0.20, 17.0), (0.83, 0.33, 14.0)] {
                    ctx.fill(fourPoint(x: W * sx, y: H * sy, r: r), with: .color(starCol.opacity(0.9)))
                }
            } else {
                // warm sun glow behind the flower head
                let glow = Path(ellipseIn: CGRect(x: W / 2 - W * 0.34, y: headY - W * 0.34, width: W * 0.68, height: W * 0.68))
                ctx.fill(glow, with: .radialGradient(
                    Gradient(colors: [Color(hex: "#F2E4AC").opacity(0.6), Color(hex: "#F2E4AC").opacity(0)]),
                    center: CGPoint(x: W / 2, y: headY), startRadius: 0, endRadius: W * 0.34))
            }

            // ---- hills (two soft overlapping mounds, like the garden)
            let hillBack = dark ? Color(hex: "#2A2D20") : Color(hex: "#DCE2C1")
            let hillFront = dark ? Color(hex: "#333927") : Color(hex: "#C7D2A2")
            ctx.fill(Path(ellipseIn: CGRect(x: -W * 0.35, y: H * 0.78, width: W * 1.1, height: H * 0.55)), with: .color(hillBack))
            ctx.fill(Path(ellipseIn: CGRect(x: W * 0.18, y: H * 0.815, width: W * 1.2, height: H * 0.6)), with: .color(hillFront))
            ctx.fill(Path(CGRect(x: 0, y: H * 0.94, width: W, height: H * 0.06)), with: .color(hillFront))

            // tiny garnish flowers on the hills
            let petalCol = dark ? Color(hex: "#EDEAD8") : Color(hex: "#FFFDF4")
            let centerCol = dark ? Color(hex: "#C9A94B") : Color(hex: "#F2C14E")
            for (fx, fy, r) in [(0.145, 0.895, 26.0), (0.855, 0.875, 30.0), (0.72, 0.955, 20.0)] {
                garnishFlower(ctx, x: W * fx, y: H * fy, r: r, petal: petalCol, center: centerCol)
            }

            // ---- the plant itself, from the app's real painter
            var pctx = ctx
            pctx.translateBy(x: x0, y: y0)
            pctx.scaleBy(x: s, y: s)
            painter.drawShadow(pctx)
            painter.drawGreen(pctx)
            painter.drawPot(pctx)
        }
    }

    private func fourPoint(x: Double, y: Double, r: Double) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: x, y: y - r))
        p.addQuadCurve(to: CGPoint(x: x + r, y: y), control: CGPoint(x: x + r * 0.18, y: y - r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x, y: y + r), control: CGPoint(x: x + r * 0.18, y: y + r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x - r, y: y), control: CGPoint(x: x - r * 0.18, y: y + r * 0.18))
        p.addQuadCurve(to: CGPoint(x: x, y: y - r), control: CGPoint(x: x - r * 0.18, y: y - r * 0.18))
        p.closeSubpath()
        return p
    }

    private func garnishFlower(_ ctx: GraphicsContext, x: Double, y: Double, r: Double, petal: Color, center: Color) {
        for i in 0..<5 {
            let a = Double(i) / 5 * .pi * 2 - .pi / 2
            let px = x + cos(a) * r * 0.72, py = y + sin(a) * r * 0.72
            ctx.fill(Path(ellipseIn: CGRect(x: px - r * 0.42, y: py - r * 0.42, width: r * 0.84, height: r * 0.84)),
                     with: .color(petal))
        }
        ctx.fill(Path(ellipseIn: CGRect(x: x - r * 0.34, y: y - r * 0.34, width: r * 0.68, height: r * 0.68)),
                 with: .color(center))
    }
}

/// viewBox y of the flower head center, so the light glow can aim at it.
func plantHeadFromSoil(species: String, level: Int) -> CGFloat {
    let L = Double(max(1, min(level, 12)))
    switch species {
    case "sunflower": return 150 - (102 - min(16 + L * 5.8, 74))
    case "cactus": return 150 - (102 - min(12 + L * 5, 66) - 4)
    case "fern": return 150 - (102 - min(16 + L * 4.2, 62) * 0.7)
    case "bonsai": return 150 - (102 - min(12 + L * 4.2, 58))
    default:
        let heights: [Double] = [0, 10, 23, 32, 39, 47, 55, 60, 65, 69, 72, 74, 76]
        return 150 - (102 - heights[max(1, min(level, 12))] - 3)
    }
}

@main
enum Main {
    @MainActor
    static func main() {
        let a = CommandLine.arguments
        guard a.count >= 5 else {
            FileHandle.standardError.write("usage: icongen <species> <level> <light|dark> <out.png> [plantH]\n".data(using: .utf8)!)
            exit(1)
        }
        let species = a[1]
        let level = Int(a[2]) ?? 12
        let dark = a[3] == "dark"
        let out = a[4]
        let plantH: CGFloat = a.count > 5 ? CGFloat(Double(a[5]) ?? 800) : 800

        let view = IconView(species: species, level: level, dark: dark, plantH: plantH)
            .frame(width: 1024, height: 1024)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        guard let cg = renderer.cgImage else {
            FileHandle.standardError.write("render failed\n".data(using: .utf8)!)
            exit(1)
        }
        let url = URL(fileURLWithPath: out)
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            FileHandle.standardError.write("cannot write \(out)\n".data(using: .utf8)!)
            exit(1)
        }
        CGImageDestinationAddImage(dest, cg, nil)
        CGImageDestinationFinalize(dest)
        print(out)
    }
}
