// WidgetSnapshot.swift — writes the GardenSnapshot and TasksSnapshot (Shared/) to the
// App Group container on every save and pokes the widget timelines. Also drains the
// check-offs tapped in the tasks widget, which can't reach real state on its own.
import Foundation
import WidgetKit

enum WidgetSnapshotWriter {
    static func write(store: AppStore) {
        writeGarden(store: store)
        writeTasks(store: store)
    }

    private static func writeGarden(store: AppStore) {
        guard let url = GardenSnapshot.url else { return }
        let top = store.state.skills
            .sorted {
                let (a, b) = (store.weekMinutes($0.id), store.weekMinutes($1.id))
                return a != b ? a > b : store.xpOf($0.id) > store.xpOf($1.id)
            }
            .first
        let snap = GardenSnapshot(
            streak: store.streak(),
            minutesToday: store.minutesOn(todayYmd()),
            minutesWeek: store.weekMinutes(),
            tierName: store.tier().cur.name,
            topSkillId: top?.id,
            topSkillName: top?.name,
            topSkillColor: top?.color,
            topSkillSpecies: top?.species,
            topSkillLevel: top.map { store.levelOf($0.id).level },
            updatedAt: Date()
        )
        if let data = try? JSONEncoder().encode(snap) {
            try? data.write(to: url, options: .atomic)
            WidgetCenter.shared.reloadTimelines(ofKind: "BloomGarden")
        }
    }

    /// Same shape as the Tasks page: due today, still open from earlier, and undated —
    /// then whatever got finished today, so the widget can show progress.
    private static func writeTasks(store: AppStore) {
        let today = todayYmd()
        let open = store.state.tasks
            .filter { !$0.done && ($0.due ?? today) <= today }
            .sorted { a, b in
                if a.priority != b.priority { return a.priority > b.priority }
                if (a.due ?? "9999") != (b.due ?? "9999") { return (a.due ?? "9999") < (b.due ?? "9999") }
                return a.createdAt < b.createdAt
            }
        let finished = store.state.tasks
            .filter { t in t.done && t.doneAt != nil && parseISO(t.doneAt!).map { ymd($0) == today } == true }
            .sorted { ($0.doneAt ?? "") > ($1.doneAt ?? "") }

        let line: (TaskItem, Bool) -> TaskLine = { t, done in
            TaskLine(id: t.id, title: t.title, done: done, skillColor: store.skill(t.skillId)?.color)
        }
        // draw their top plant beside the list, so the widget matches the garden
        let top = store.state.skills
            .sorted {
                let (a, b) = (store.weekMinutes($0.id), store.weekMinutes($1.id))
                return a != b ? a > b : store.xpOf($0.id) > store.xpOf($1.id)
            }
            .first
        let snap = TasksSnapshot(
            ymd: today,
            lines: open.map { line($0, false) } + finished.map { line($0, true) },
            doneToday: finished.count,
            minutesToday: store.minutesOn(today),
            updatedAt: Date(),
            plantId: top?.id,
            plantColor: top?.color,
            plantSpecies: top?.species
        )
        snap.write()
        WidgetCenter.shared.reloadTimelines(ofKind: "BloomTasks")
    }

    /// Apply check-offs tapped on the Home Screen. Runs on foreground, before the user
    /// sees the list, so the app and the widget agree. Goes through toggleTask so
    /// repeats roll forward and keepsakes still fire.
    static func applyPendingToggles(store: AppStore) {
        let ids = PendingTaskToggles.drain()
        guard !ids.isEmpty else { return }
        for id in ids where store.state.tasks.contains(where: { $0.id == id }) {
            store.toggleTask(id)
        }
    }
}
