// FocusActivityAttributes.swift — the Live Activity contract shared by app + widget extension.
import Foundation
import ActivityKit

struct FocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startedAt: Date            // start of the current phase (already shifted by pauses)
        var endsAt: Date               // wall-clock end of the current phase
        var phase: String              // "work" | "break"
        var round: Int
        var paused: Bool
        var remainingWhenPaused: TimeInterval?
    }

    var skillId: String                // seeds the plant art — must match the app's
    var skillName: String
    var skillColorHex: String          // pot color, e.g. "#C97F5F"
    var species: String?               // plant species key for the tiny plant art
    var level: Int
    var mode: String                   // "single" | "cycle"
}
