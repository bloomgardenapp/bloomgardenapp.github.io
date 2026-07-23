// GardenSnapshot.swift — the light garden summary the app writes to the App Group
// container on every save, and the widget reads to draw without the full state.
import Foundation

struct GardenSnapshot: Codable {
    var streak: Int
    var minutesToday: Int
    var minutesWeek: Int
    var tierName: String
    var topSkillId: String?
    var topSkillName: String?
    var topSkillColor: String?
    var topSkillSpecies: String?
    var topSkillLevel: Int?
    var updatedAt: Date

    static let appGroup = "group.com.jasmine.bloom"
    static let fileName = "garden-snapshot.json"

    static var url: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(fileName)
    }

    static func read() -> GardenSnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(GardenSnapshot.self, from: data)
    }
}

/// Shared minute formatter (util.js fmtMin) for widget surfaces.
func fmtMinShort(_ min: Int) -> String {
    let h = min / 60, m = min % 60
    return h > 0 ? (m > 0 ? "\(h)h \(m)m" : "\(h)h") : "\(m)m"
}
