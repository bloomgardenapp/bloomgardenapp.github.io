// TasksWidget.swift — today's list on the Home Screen, with working check-off.
// Tapping a circle runs ToggleTaskIntent in this extension: it queues the toggle for
// the app and flips the snapshot so the row redraws checked right away. See
// Shared/TasksSnapshot.swift for why the widget can't write real state directly.
import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Check off from the Home Screen

struct ToggleTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Check off a task"
    /// widget-only — no reason for this to show up in Shortcuts
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Task") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        PendingTaskToggles.append(taskId)
        if var snap = TasksSnapshot.read(),
           let i = snap.lines.firstIndex(where: { $0.id == taskId }) {
            snap.lines[i].done.toggle()
            snap.doneToday = max(0, snap.doneToday + (snap.lines[i].done ? 1 : -1))
            snap.write()
        }
        return .result()
    }
}

// MARK: - Timeline

struct TasksEntry: TimelineEntry {
    let date: Date
    let snap: TasksSnapshot?
}

struct TasksProvider: TimelineProvider {
    private var sample: TasksSnapshot {
        TasksSnapshot(ymd: "", lines: [
            TaskLine(id: "a", title: "Finish physics worksheet", done: false, skillColor: "#C97F5F"),
            TaskLine(id: "b", title: "Email Ms. Chen", done: false, skillColor: nil),
            TaskLine(id: "c", title: "Read chapter 7", done: true, skillColor: "#7C8B4F"),
        ], doneToday: 1, minutesToday: 45, updatedAt: .now,
           plantId: "widget-preview", plantColor: "#C97F5F", plantSpecies: "bloom")
    }

    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(date: .now, snap: sample)
    }
    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        completion(TasksEntry(date: .now, snap: context.isPreview ? sample : TasksSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        // refresh just after midnight so the list rolls over to the new day on its own
        let entry = TasksEntry(date: .now, snap: TasksSnapshot.read())
        let midnight = Calendar.current.nextDate(after: .now, matching: DateComponents(hour: 0, minute: 2),
                                                 matchingPolicy: .nextTime) ?? .now.addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(min(midnight, .now.addingTimeInterval(3 * 3600)))))
    }
}

// MARK: - View

struct TasksWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var entry: TasksEntry

    private var ink: Color { scheme == .dark ? W.inkDark : W.ink }
    private var inkStrong: Color { scheme == .dark ? W.inkStrongDark : W.inkStrong }
    private var muted: Color { scheme == .dark ? W.mutedDark : W.muted }
    private var olive: Color { scheme == .dark ? W.oliveDark : W.olive }

    private var maxRows: Int {
        switch family {
        case .systemSmall: return 3
        case .systemLarge: return 9
        default: return 5
        }
    }

    var body: some View {
        Group {
            if let s = entry.snap, !s.lines.isEmpty {
                list(s)
            } else {
                empty
            }
        }
        .containerBackground(for: .widget) {
            scheme == .dark ? W.darkCard : W.creamCard
        }
    }

    /// Their top plant, grown to match how much of the day is done.
    private func plant(_ s: TasksSnapshot, width: Double) -> some View {
        CroppedPlantView(
            spec: PlantSpec(id: s.plantId ?? "bloom-tasks",
                            colorHex: s.plantColor ?? "#7C8B4F",
                            species: s.plantSpecies),
            level: s.growthLevel,
            width: width
        )
    }

    private var empty: some View {
        let s = entry.snap
        return VStack(spacing: 6) {
            if let s {
                plant(s, width: family == .systemSmall ? 68 : 92)
            } else {
                Text("🌱").font(.system(size: 26))
            }
            Text(s == nil ? "Open Bloom to see today's tasks"
                          : "Nothing due today — a fresh page.")
                .font(W.body(11))
                .foregroundColor(muted)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 6)
    }

    private func list(_ s: TasksSnapshot) -> some View {
        // open first, then today's finished ones — and never let done rows
        // push an open task off a small widget
        let ordered = s.lines.filter { !$0.done } + s.lines.filter(\.done)
        let shown = Array(ordered.prefix(maxRows))
        let hidden = ordered.count - shown.count

        return HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 0) {
                // on small there's no width for a side column, so the plant leads
                // the card instead — centered above the list
                if family == .systemSmall {
                    plant(s, width: 60).frame(maxWidth: .infinity, alignment: .center)
                } else {
                    header(s)
                }
                VStack(alignment: .leading, spacing: family == .systemSmall ? 5 : 6) {
                    ForEach(shown) { row($0) }
                }
                .padding(.top, family == .systemSmall ? 4 : 7)

                Spacer(minLength: 2)

                if hidden > 0 {
                    Text("+\(hidden) more")
                        .font(W.body(10))
                        .foregroundColor(muted)
                        .padding(.bottom, 2)
                }
                footer(s)
            }
            // vertically centered against the list, so it reads as the card's
            // centerpiece rather than something parked in the corner
            if family != .systemSmall {
                plant(s, width: family == .systemLarge ? 122 : 92)
            }
        }
    }

    private func header(_ s: TasksSnapshot) -> some View {
        HStack(spacing: 5) {
            Text("Today").font(W.display(17)).foregroundColor(inkStrong)
            Spacer(minLength: 0)
            if s.minutesToday > 0 {
                Text(fmtMinShort(s.minutesToday)).font(W.bold(11)).foregroundColor(olive)
            }
        }
    }

    private func row(_ line: TaskLine) -> some View {
        Button(intent: ToggleTaskIntent(taskId: line.id)) {
            HStack(spacing: 7) {
                Image(systemName: line.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: family == .systemSmall ? 12 : 13.5, weight: .medium))
                    .foregroundColor(line.done ? olive : muted)
                Text(line.title)
                    .font(W.body(family == .systemSmall ? 11.5 : 12.5))
                    .strikethrough(line.done, color: muted)
                    .foregroundColor(line.done ? muted : ink)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
                if let hex = line.skillColor, !line.done {
                    Circle().fill(Color(hex: hex)).frame(width: 5, height: 5)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func footer(_ s: TasksSnapshot) -> some View {
        let total = s.lines.count
        let done = s.lines.filter(\.done).count
        let allDone = done == total && total > 0
        return HStack(spacing: 4) {
            Text("\(done) of \(total)")
                .font(W.bold(10.5))
                .foregroundColor(allDone ? olive : muted)
            Text("· \(s.cheer)")
                .font(W.body(10.5))
                .foregroundColor(allDone ? olive : muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

struct TasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BloomTasks", provider: TasksProvider()) { entry in
            TasksWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's tasks")
        .description("The day's list — check things off without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
