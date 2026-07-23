// Components.swift — Bloom's design system in SwiftUI: cards, chips, pill buttons,
// serif-italic titles, XP bars, bar charts, toasts, confetti.
import SwiftUI

// MARK: - Card

struct CardModifier: ViewModifier {
    @Environment(\.theme) private var theme
    var padding: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(theme.line, lineWidth: 1))
            .shadow(color: Color(red: 74/255, green: 82/255, blue: 56/255).opacity(theme.isDark ? 0 : 0.09), radius: 5, y: 2)
    }
}

extension View {
    func card(padding: CGFloat = 18) -> some View { modifier(CardModifier(padding: padding)) }
}

// MARK: - Serif titles: "Your *garden*" pattern

struct BloomTitle: View {
    @Environment(\.theme) private var theme
    var prefix: String
    var em: String
    var suffix: String = ""
    var icon: String? = nil
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: 6) {
            (Text(prefix).font(.display(size))
                + Text(em).font(.displayItalic(size)).foregroundColor(theme.olive2)
                + Text(suffix).font(.display(size)))
                .foregroundColor(theme.inkStrong)
            if let icon {
                Ic(name: icon, size: size * 0.75)
                    .foregroundColor(theme.olive)
            }
        }
    }
}

// MARK: - Chips

enum ChipStyle {
    case plain, green, lilac, coral, sun, overdue, dueToday

    func bg(_ t: BloomTheme) -> Color {
        switch self {
        case .plain: return t.card2
        case .green: return t.greenSoft
        case .lilac: return t.skySoft
        case .coral: return t.coralSoft
        case .sun: return t.sunSoft
        case .overdue: return t.roseSoft
        case .dueToday: return t.peachSoft
        }
    }
}

struct Chip: View {
    @Environment(\.theme) private var theme
    var text: String
    var icon: String? = nil
    var style: ChipStyle = .plain
    var selected: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            if let icon { Ic(name: icon, size: 10) }
            Text(text).font(.quicksandBold(12))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(selected ? theme.olive : style.bg(theme))
        .foregroundColor(selected ? Color(hex: "#FFFDF4") : theme.ink)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(selected ? Color.clear : theme.line, lineWidth: 1))
    }
}

// MARK: - Pill buttons

enum PillStyle { case plain, primary, green, danger, big, primaryBig }

struct PillButtonStyle: ButtonStyle {
    @Environment(\.theme) private var theme
    var kind: PillStyle = .plain

    func makeBody(configuration: Configuration) -> some View {
        let big = kind == .big || kind == .primaryBig
        let primary = kind == .primary || kind == .primaryBig
        return configuration.label
            .font(.quicksandBold(big ? 15 : 13))
            .padding(.horizontal, big ? 20 : 14)
            .padding(.vertical, big ? 11 : 7)
            .background(
                Capsule().fill(
                    primary ? theme.olive :
                    kind == .green ? theme.greenSoft :
                    kind == .danger ? theme.roseSoft : theme.card
                )
            )
            .foregroundColor(
                primary ? Color(hex: "#FFFDF4") :
                kind == .danger ? theme.coralStrong : theme.ink
            )
            .overlay(Capsule().stroke(primary ? Color.clear : theme.lineStrong, lineWidth: 1.5))
            .opacity(configuration.isPressed ? 0.75 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

// MARK: - XP bar

struct XPBar: View {
    @Environment(\.theme) private var theme
    var progress: Double            // 0…1
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(theme.track)
                Capsule()
                    .fill(LinearGradient(colors: [Color(hex: "#7C8B4F"), Color(hex: "#A3BC6E")], startPoint: .bottom, endPoint: .top))
                    .frame(width: max(height, geo.size.width * min(max(progress, 0), 1)))
            }
        }
        .frame(height: height)
        .animation(.easeOut(duration: 0.4), value: progress)
    }
}

// MARK: - Bar chart (charts.js barChartSVG)

struct BarChart: View {
    @Environment(\.theme) private var theme
    var values: [Int]
    var labels: [String]
    var height: CGFloat = 72

    var body: some View {
        let maxV = max(values.max() ?? 0, 30)
        HStack(alignment: .bottom, spacing: values.count > 12 ? 3 : 8) {
            ForEach(values.indices, id: \.self) { i in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: values.count > 12 ? 2.5 : 6, style: .continuous)
                        .fill(values[i] > 0
                              ? AnyShapeStyle(LinearGradient(colors: [Color(hex: "#7C8B4F"), Color(hex: "#A3BC6E")], startPoint: .bottom, endPoint: .top))
                              : AnyShapeStyle(theme.track))
                        .frame(height: max(values[i] > 0 ? 5 : 2.5, CGFloat(values[i]) / CGFloat(maxV) * height))
                        .frame(maxHeight: height, alignment: .bottom)
                    if !labels.isEmpty {
                        Text(i < labels.count ? labels[i] : "")
                            .font(.quicksandBold(9))
                            .foregroundColor(theme.muted)
                            .lineLimit(1)
                            .fixedSize()
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: height + (labels.isEmpty ? 0 : 16), alignment: .bottom)
    }
}

func dayLabels7() -> [String] {
    let names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    return (0..<7).reversed().map { i in
        i == 0 ? "★" : names[weekday(of: addDays(todayYmd(), -i))]
    }
}

// MARK: - Stat tile (Today's stats row)

struct StatTile: View {
    @Environment(\.theme) private var theme
    var icon: String
    var tile: Color
    var num: String
    var label: String

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(tile)
                .frame(width: 42, height: 42)
                .overlay(Ic(name: icon, size: 17).foregroundColor(theme.inkStrong))
            VStack(alignment: .leading, spacing: 2) {
                Text(num).font(.quicksandBold(17)).foregroundColor(theme.inkStrong)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(label).font(.quicksand(11)).foregroundColor(theme.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(13)
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(theme.line, lineWidth: 1))
    }
}

// MARK: - Empty state

struct EmptyState: View {
    @Environment(\.theme) private var theme
    var icon: String
    var text: String

    var body: some View {
        VStack(spacing: 8) {
            Ic(name: icon, size: 26).foregroundColor(theme.muted)
            Text(text)
                .font(.quicksand(13.5))
                .foregroundColor(theme.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(theme.line, style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
        )
    }
}

// MARK: - Toasts

struct ToastOverlay: View {
    @Environment(\.theme) private var theme
    var toasts: [ToastItem]

    var body: some View {
        VStack(spacing: 8) {
            Spacer()
            ForEach(toasts) { t in
                HStack(spacing: 8) {
                    Ic(name: t.icon, size: 14).foregroundColor(theme.olive)
                    Text(t.message)
                        .font(.quicksandBold(13))
                        .foregroundColor(theme.inkStrong)
                        .lineLimit(2)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(theme.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(theme.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.bottom, 68)
        .animation(.spring(duration: 0.35), value: toasts)
        .allowsHitTesting(false)
    }
}

// MARK: - Confetti (confetti.js rain/burst, in spirit)

private struct ConfettiPiece: Identifiable {
    let id = UUID()
    var x: Double        // 0…1 across the screen
    var delay: Double
    var fall: Double     // seconds to fall
    var size: Double
    var color: Color
    var spin: Double
}

struct ConfettiOverlay: View {
    var tick: Int
    @State private var pieces: [ConfettiPiece] = []
    @State private var animating = false

    private static let colors = PALETTE.map { Color(hex: $0) } + [Color(hex: "#FFD45E"), Color(hex: "#A3BC6E")]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(pieces) { p in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(p.color)
                        .frame(width: p.size, height: p.size * 0.55)
                        .rotationEffect(.degrees(animating ? p.spin : 0))
                        .position(x: p.x * geo.size.width,
                                  y: animating ? geo.size.height + 30 : -30)
                        .animation(.easeIn(duration: p.fall).delay(p.delay), value: animating)
                }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: tick) {
            guard tick > 0 else { return }
            pieces = (0..<44).map { _ in
                ConfettiPiece(x: .random(in: 0...1), delay: .random(in: 0...0.5),
                              fall: .random(in: 1.4...2.4), size: .random(in: 7...12),
                              color: Self.colors.randomElement()!, spin: .random(in: 180...720))
            }
            animating = false
            DispatchQueue.main.async { animating = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.2) {
                pieces = []
                animating = false
            }
        }
    }
}
