// Theme.swift — the sage garden storybook: cream + olive + serif italics.
// Tokens lifted verbatim from css/style.css. Bloom's theme is a synced SETTING
// (day garden by default, night garden opt-in) — never OS-forced.
import SwiftUI

struct BloomTheme {
    var bg, card, card2, ink, inkStrong, muted, line, lineStrong: Color
    var olive, olive2, oliveSoft, green, greenSoft: Color
    var coral, coralStrong, coralSoft: Color
    var mintSoft, peachSoft, roseSoft, sunSoft, skySoft, track: Color
    var hsky1, hsky2, hsun, hill1, htree1, hill2, htree2, hill3, htree3, hflower, hcloud: Color
    var isDark: Bool

    static let light = BloomTheme(
        bg: Color(hex: "#F4F0E2"), card: Color(hex: "#FFFDF4"), card2: Color(hex: "#F5F1E1"),
        ink: Color(hex: "#4A5238"), inkStrong: Color(hex: "#3A422C"), muted: Color(hex: "#8F937D"),
        line: Color(red: 96/255, green: 108/255, blue: 62/255).opacity(0.16),
        lineStrong: Color(red: 96/255, green: 108/255, blue: 62/255).opacity(0.30),
        olive: Color(hex: "#7C8B4F"), olive2: Color(hex: "#67753E"), oliveSoft: Color(hex: "#E9ECD3"),
        green: Color(hex: "#7FA05C"), greenSoft: Color(hex: "#E4EDD0"),
        coral: Color(hex: "#C97F5F"), coralStrong: Color(hex: "#B4643F"), coralSoft: Color(hex: "#F4E3D8"),
        mintSoft: Color(hex: "#DFECDC"), peachSoft: Color(hex: "#F6E9CF"), roseSoft: Color(hex: "#F2E1DC"),
        sunSoft: Color(hex: "#F5EDC8"), skySoft: Color(hex: "#E0EAF0"), track: Color(hex: "#EAE5CF"),
        hsky1: Color(hex: "#F1EEDA"), hsky2: Color(hex: "#E9E9CD"), hsun: Color(hex: "#F2E4AC"),
        hill1: Color(hex: "#DCE2C1"), htree1: Color(hex: "#B2C089"),
        hill2: Color(hex: "#C7D2A2"), htree2: Color(hex: "#9AAB70"),
        hill3: Color(hex: "#A6B87A"), htree3: Color(hex: "#71864B"),
        hflower: Color(hex: "#FFFDF4"),
        hcloud: Color(red: 1, green: 253/255, blue: 244/255).opacity(0.85),
        isDark: false
    )

    static let dark = BloomTheme(
        bg: Color(hex: "#161513"), card: Color(hex: "#211F1C"), card2: Color(hex: "#2B2824"),
        ink: Color(hex: "#EAE6DD"), inkStrong: Color(hex: "#FAF7F0"), muted: Color(hex: "#A8A296"),
        line: Color(red: 234/255, green: 230/255, blue: 221/255).opacity(0.13),
        lineStrong: Color(red: 234/255, green: 230/255, blue: 221/255).opacity(0.30),
        olive: Color(hex: "#A9BE74"), olive2: Color(hex: "#C8DC96"), oliveSoft: Color(hex: "#34382A"),
        green: Color(hex: "#A3C476"), greenSoft: Color(hex: "#2F3727"),
        coral: Color(hex: "#E2A180"), coralStrong: Color(hex: "#ECB394"), coralSoft: Color(hex: "#462E22"),
        mintSoft: Color(hex: "#26382F"), peachSoft: Color(hex: "#453322"), roseSoft: Color(hex: "#432B2E"),
        sunSoft: Color(hex: "#423A1F"), skySoft: Color(hex: "#233440"), track: Color(hex: "#35322C"),
        hsky1: Color(hex: "#201E1B"), hsky2: Color(hex: "#181714"), hsun: Color(hex: "#E9E3CD"),
        hill1: Color(hex: "#2A2D20"), htree1: Color(hex: "#3E4530"),
        hill2: Color(hex: "#333927"), htree2: Color(hex: "#4A5535"),
        hill3: Color(hex: "#3F482B"), htree3: Color(hex: "#5A683D"),
        hflower: Color(hex: "#EDEAD8"),
        hcloud: Color(red: 233/255, green: 227/255, blue: 205/255).opacity(0.07),
        isDark: true
    )
}

private struct BloomThemeKey: EnvironmentKey {
    static let defaultValue = BloomTheme.light
}

extension EnvironmentValues {
    var theme: BloomTheme {
        get { self[BloomThemeKey.self] }
        set { self[BloomThemeKey.self] = newValue }
    }
}

// MARK: - Fonts (Fraunces for display, Quicksand for body — the storybook pair)

extension Font {
    static func display(_ size: CGFloat) -> Font { .custom("Fraunces-SemiBold", size: size) }
    static func displayItalic(_ size: CGFloat) -> Font { .custom("Fraunces-MediumItalic", size: size) }
    static func quicksand(_ size: CGFloat) -> Font { .custom("Quicksand-Medium", size: size) }
    static func quicksandBold(_ size: CGFloat) -> Font { .custom("Quicksand-Bold", size: size) }
}
