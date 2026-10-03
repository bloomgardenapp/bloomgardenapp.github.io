// TasksSnapshot.swift — the day's task list the app writes to the App Group container,
// and the Today's Tasks widget reads to draw without the full state.
//
// The app's real state lives in its own Application Support container, which the widget
// extension can't reach — so a check-off tapped on the Home Screen can't mutate it
// directly. Instead the widget flips its snapshot (instant visual feedback) and queues
// the toggle here; the app drains the queue and applies it for real on next foreground.
import Foundation

struct TaskLine: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var done: Bool
    var skillColor: String?      // plant hex, nil when the task isn't linked to one
}

struct TasksSnapshot: Codable {
    var ymd: String              // the day this list belongs to
    var lines: [TaskLine]        // open tasks for the day, then the ones finished today
    var doneToday: Int
    var minutesToday: Int
    var updatedAt: Date
    // the plant drawn beside the list — their top plant, so the widget matches the garden
    var plantId: String? = nil
    var plantColor: String? = nil
    var plantSpecies: String? = nil

    /// The day's plant grows as the list gets done: a sprout at none, full bloom at all.
    var growthLevel: Int {
        guard !lines.isEmpty else { return 7 }
        let done = lines.filter(\.done).count
        return max(1, min(12, 1 + Int((Double(done) / Double(lines.count) * 11).rounded())))
    }

    /// Small bit of encouragement under the list — the widget's whole personality.
    var cheer: String {
        let done = lines.filter(\.done).count, total = lines.count
        guard total > 0 else { return "a fresh page" }
        if done == total { return "all done today!" }
        if done == 0 { return "let's grow" }
        let frac = Double(done) / Double(total)
        return frac >= 0.75 ? "almost there!" : frac >= 0.4 ? "keep going" : "off to a start"
    }

    static let fileName = "tasks-snapshot.json"
    static let pendingFileName = "pending-task-toggles.json"

    static func url(_ name: String) -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: GardenSnapshot.appGroup)?
            .appendingPathComponent(name)
    }

    static func read() -> TasksSnapshot? {
        guard let u = url(fileName), let data = try? Data(contentsOf: u) else { return nil }
        return try? JSONDecoder().decode(TasksSnapshot.self, from: data)
    }

    func write() {
        guard let u = Self.url(Self.fileName), let data = try? JSONEncoder().encode(self) else { return }
        try? data.write(to: u, options: .atomic)
    }
}

/// Check-offs tapped in the widget, waiting for the app to apply them to real state.
/// Stored as a plain list of task ids — two entries for the same id mean two taps,
/// which correctly cancel out.
enum PendingTaskToggles {
    static func read() -> [String] {
        guard let u = TasksSnapshot.url(TasksSnapshot.pendingFileName),
              let data = try? Data(contentsOf: u) else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    static func write(_ ids: [String]) {
        guard let u = TasksSnapshot.url(TasksSnapshot.pendingFileName) else { return }
        guard !ids.isEmpty else { try? FileManager.default.removeItem(at: u); return }
        if let data = try? JSONEncoder().encode(ids) { try? data.write(to: u, options: .atomic) }
    }

    static func append(_ id: String) { write(read() + [id]) }

    /// Read and clear together, so a tap landing mid-drain isn't applied twice.
    static func drain() -> [String] {
        let ids = read()
        if !ids.isEmpty { write([]) }
        return ids
    }
}
