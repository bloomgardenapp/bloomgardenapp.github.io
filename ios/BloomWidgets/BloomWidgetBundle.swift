// BloomWidgetBundle.swift — the garden on your Home Screen, and the focus timer
// in the Dynamic Island / Lock Screen while a session runs.
import WidgetKit
import SwiftUI

@main
struct BloomWidgetBundle: WidgetBundle {
    var body: some Widget {
        GardenWidget()
        FocusLiveActivity()
    }
}

// MARK: - Bloom-flavored colors/fonts for widget surfaces

private enum W {
    static let cream = Color(hex: "#F4F0E2")
    static let creamCard = Color(hex: "#FFFDF4")
    static let darkCard = Color(hex: "#211F1C")
    static let ink = Color(hex: "#4A5238")
    static let inkStrong = Color(hex: "#3A422C")
    static let inkDark = Color(hex: "#EAE6DD")
    static let inkStrongDark = Color(hex: "#FAF7F0")
    static let muted = Color(hex: "#8F937D")
    static let mutedDark = Color(hex: "#A8A296")
    static let olive = Color(hex: "#7C8B4F")
    static let oliveDark = Color(hex: "#A9BE74")

    static func display(_ s: CGFloat) -> Font { .custom("Fraunces-SemiBold", size: s) }
    static func body(_ s: CGFloat) -> Font { .custom("Quicksand-Medium", size: s) }
    static func bold(_ s: CGFloat) -> Font { .custom("Quicksand-Bold", size: s) }
}

// MARK: - Garden widget

struct GardenEntry: TimelineEntry {
    let date: Date
    let snap: GardenSnapshot?
}

struct GardenProvider: TimelineProvider {
    func placeholder(in context: Context) -> GardenEntry {
        GardenEntry(date: .now, snap: GardenSnapshot(
            streak: 5, minutesToday: 45, minutesWeek: 320, tierName: "Bud",
            topSkillId: "widget-preview", topSkillName: "Math", topSkillColor: "#C97F5F", topSkillSpecies: "bloom",
            topSkillLevel: 6, updatedAt: .now))
    }
    func getSnapshot(in context: Context, completion: @escaping (GardenEntry) -> Void) {
        completion(GardenEntry(date: .now, snap: GardenSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<GardenEntry>) -> Void) {
        // refresh after midnight so "today" resets even without an app launch
        let entry = GardenEntry(date: .now, snap: GardenSnapshot.read())
        let midnight = Calendar.current.nextDate(after: .now, matching: DateComponents(hour: 0, minute: 2), matchingPolicy: .nextTime) ?? .now.addingTimeInterval(3600)
        let refresh = min(midnight, .now.addingTimeInterval(3 * 3600))
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

struct GardenWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var entry: GardenEntry

    private var ink: Color { scheme == .dark ? W.inkDark : W.ink }
    private var inkStrong: Color { scheme == .dark ? W.inkStrongDark : W.inkStrong }
    private var muted: Color { scheme == .dark ? W.mutedDark : W.muted }
    private var olive: Color { scheme == .dark ? W.oliveDark : W.olive }

    var body: some View {
        Group {
            if let s = entry.snap {
                if family == .systemMedium { medium(s) } else { small(s) }
            } else {
                VStack(spacing: 4) {
                    Text("🌼").font(.system(size: 28))
                    Text("Open Bloom to plant your garden")
                        .font(W.body(11)).foregroundColor(muted)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .containerBackground(for: .widget) {
            scheme == .dark ? W.darkCard : W.creamCard
        }
    }

    private func plant(_ s: GardenSnapshot, size: CGFloat) -> some View {
        Group {
            if let name = s.topSkillName, s.topSkillLevel != nil {
                // seed by the real skill id so the widget plant matches the app's exactly
                PlantView(spec: PlantSpec(id: s.topSkillId ?? name, colorHex: s.topSkillColor ?? "#C97F5F", species: s.topSkillSpecies),
                          level: s.topSkillLevel ?? 1)
                    .frame(height: size)
            } else {
                Text("🌼").font(.system(size: size * 0.5))
            }
        }
    }

    private func small(_ s: GardenSnapshot) -> some View {
        VStack(spacing: 3) {
            plant(s, size: 74)
            HStack(spacing: 8) {
                HStack(spacing: 2) {
                    Image(systemName: "flame").font(.system(size: 10, weight: .semibold))
                    Text("\(s.streak)").font(W.bold(13))
                }
                .foregroundColor(olive)
                Text(fmtMinShort(s.minutesToday)).font(W.bold(13)).foregroundColor(inkStrong)
            }
            Text(s.minutesToday > 0 ? "grown today" : "water me today")
                .font(W.body(10)).foregroundColor(muted)
        }
    }

    private func medium(_ s: GardenSnapshot) -> some View {
        HStack(spacing: 14) {
            plant(s, size: 96)
            VStack(alignment: .leading, spacing: 4) {
                if let name = s.topSkillName {
                    (Text(name).font(W.display(16)) + Text("  lv \(s.topSkillLevel ?? 1)").font(W.bold(11)))
                        .foregroundColor(inkStrong)
                }
                HStack(spacing: 3) {
                    Image(systemName: "flame").font(.system(size: 11, weight: .semibold))
                    Text("\(s.streak) day streak").font(W.bold(12))
                }
                .foregroundColor(olive)
                Text("\(fmtMinShort(s.minutesToday)) today · \(fmtMinShort(s.minutesWeek)) this week")
                    .font(W.body(11.5)).foregroundColor(ink)
                Text("garden tier · \(s.tierName)")
                    .font(W.body(10.5)).foregroundColor(muted)
            }
            Spacer(minLength: 0)
        }
    }
}

struct GardenWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BloomGarden", provider: GardenProvider()) { entry in
            GardenWidgetView(entry: entry)
        }
        .configurationDisplayName("Garden")
        .description("Your streak, today's growth, and your favorite plant.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Focus Live Activity

struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in
            LockScreenFocusView(context: context)
                .activityBackgroundTint(W.creamCard.opacity(0.96))
                .activitySystemActionForegroundColor(W.olive)
        } dynamicIsland: { context in
            let color = Color(hex: context.attributes.skillColorHex)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PlantView(spec: PlantSpec(id: context.attributes.skillId, colorHex: context.attributes.skillColorHex, species: context.attributes.species),
                              level: context.attributes.level)
                        .frame(width: 44, height: 55)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 1) {
                        Text(context.state.phase == "break" ? "little break" : context.attributes.skillName)
                            .font(W.bold(13)).foregroundColor(.white)
                        timerText(context, font: W.display(26))
                            .foregroundColor(color)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                        .progressViewStyle(.linear)
                        .tint(color)
                        .labelsHidden()
                }
            } compactLeading: {
                Image(systemName: context.state.phase == "break" ? "leaf" : "hourglass")
                    .foregroundColor(color)
            } compactTrailing: {
                timerText(context, font: .system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundColor(color)
                    .frame(maxWidth: 46)
            } minimal: {
                Image(systemName: "hourglass").foregroundColor(color)
            }
        }
    }

    private func timerText(_ context: ActivityViewContext<FocusActivityAttributes>, font: Font) -> Text {
        if context.state.paused, let rem = context.state.remainingWhenPaused {
            let m = Int(rem) / 60, s = Int(rem) % 60
            return Text(String(format: "%d:%02d", m, s)).font(font)
        }
        return Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true, showsHours: false)
            .font(font)
    }
}

struct LockScreenFocusView: View {
    var context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        let color = Color(hex: context.attributes.skillColorHex)
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                PlantView(spec: PlantSpec(id: context.attributes.skillId, colorHex: context.attributes.skillColorHex, species: context.attributes.species),
                          level: context.attributes.level)
                    .frame(width: 42, height: 52)
                VStack(alignment: .leading, spacing: 1) {
                    Text(context.state.phase == "break"
                         ? (context.state.round == 0 ? "warm-up break" : "little break")
                         : "Growing \(context.attributes.skillName)")
                        .font(W.bold(14))
                        .foregroundColor(W.inkStrong)
                    Text(context.state.paused ? "paused" : (context.state.phase == "break" ? "back to it soon" : "every minute = 1 XP"))
                        .font(W.body(11))
                        .foregroundColor(W.muted)
                }
                Spacer()
                Group {
                    if context.state.paused, let rem = context.state.remainingWhenPaused {
                        Text(String(format: "%d:%02d", Int(rem) / 60, Int(rem) % 60))
                    } else {
                        Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true, showsHours: false)
                    }
                }
                .font(W.display(30))
                .monospacedDigit()
                .foregroundColor(W.inkStrong)
                .frame(maxWidth: 96, alignment: .trailing)
            }
            ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                .progressViewStyle(.linear)
                .tint(color)
                .labelsHidden()
        }
        .padding(14)
    }
}
