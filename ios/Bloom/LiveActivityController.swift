// LiveActivityController.swift — mirrors the running timer into a Live Activity
// (Dynamic Island + Lock Screen). One activity at a time; phase changes update it.
import Foundation
import ActivityKit

final class LiveActivityController {
    static let shared = LiveActivityController()
    private var activity: Activity<FocusActivityAttributes>?

    func startOrUpdate(store: AppStore) {
        guard let t = store.state.timer else { end(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let sk = store.skill(t.skillId)
        let remaining = store.timerRemaining()
        let now = Date()
        let attrs = FocusActivityAttributes(
            skillId: sk?.id ?? "free-focus",
            skillName: sk?.name ?? (t.phase == "break" ? "little break" : "just focusing"),
            skillColorHex: sk?.color ?? (t.phase == "break" ? "#7FA98F" : "#8FA35E"),
            species: sk != nil ? sk?.species : "fern",
            level: sk.map { store.levelOf($0.id).level } ?? 1,
            mode: t.mode
        )
        let contentState = FocusActivityAttributes.ContentState(
            startedAt: now.addingTimeInterval(-(t.durationSec - remaining)),
            endsAt: now.addingTimeInterval(remaining),
            phase: t.phase,
            round: t.round,
            paused: t.pausedAt != nil,
            remainingWhenPaused: t.pausedAt != nil ? remaining : nil
        )

        if let activity {
            Task { await activity.update(ActivityContent(state: contentState, staleDate: nil)) }
        } else {
            // a previous run may have left an orphan behind (e.g. app relaunch) — adopt it
            if let orphan = Activity<FocusActivityAttributes>.activities.first {
                activity = orphan
                Task { await orphan.update(ActivityContent(state: contentState, staleDate: nil)) }
                return
            }
            activity = try? Activity.request(
                attributes: attrs,
                content: ActivityContent(state: contentState, staleDate: nil)
            )
            #if DEBUG
            print("bloom.liveactivity started:", activity?.id ?? "request failed")
            #endif
        }
    }

    func end() {
        let current = activity ?? Activity<FocusActivityAttributes>.activities.first
        activity = nil
        guard let current else { return }
        Task { await current.end(nil, dismissalPolicy: .immediate) }
    }
}
