// WidgetSnapshot.swift — writes the GardenSnapshot (Shared/) to the App Group container
// on every save and pokes the widget timeline.
import Foundation
import WidgetKit

enum WidgetSnapshotWriter {
    static func write(store: AppStore) {
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
}
