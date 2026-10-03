// Store.swift — single source of truth. Ports store.js (persistence), progress.js
// (XP/streak/keepsakes) and the focus.js timer engine. Views mutate through methods;
// every mutation lands in save(), which persists, syncs, and refreshes widgets.
import Foundation
import Observation

struct ToastItem: Identifiable, Equatable {
    let id = UUID()
    var message: String
    var icon: String
}

@Observable
final class AppStore: ProgressQueries {
    var state: BloomState
    var toasts: [ToastItem] = []
    var confettiTick = 0          // bump = rain confetti
    var burstTick = 0             // bump = small burst
    var zenPresented = false

    /// cloud sync hooks in here — fires on every save, silent or not
    @ObservationIgnored var onSave: (() -> Void)?

    @ObservationIgnored private var saveDebounce: Timer?

    // MARK: - Persistence

    static let fileName = "bloom.v1.json"

    static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(fileName)
    }

    init() {
        state = Self.load()
    }

    static func load() -> BloomState {
        guard let data = try? Data(contentsOf: fileURL),
              let s = try? JSONDecoder().decode(BloomState.self, from: data),
              s.version == 1
        else { return BloomState() }
        return s
    }

    func save(silent: Bool = false) {
        state.editedAt = nowISO()
        persist()
        onSave?()
        WidgetSnapshotWriter.write(store: self)
        NotificationPlanner.sync(store: self)
    }

    private func persist() {
        do {
            let data = try JSONEncoder().encode(state)
            try data.write(to: Self.fileURL, options: .atomic)
        } catch {
            print("Bloom: save failed", error)
        }
    }

    /// cloud pull replaces everything (defaults already applied by decoding)
    func replace(_ next: BloomState) {
        var s = next
        s.version = 1
        state = s
        save()
    }

    func reset() {
        state = BloomState()
        save()
    }

    func toast(_ message: String, _ icon: String = "sprout") {
        toasts.append(ToastItem(message: message, icon: icon))
        if toasts.count > 4 { toasts.removeFirst(toasts.count - 4) }
        let id = toasts.last!.id
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.6) { [weak self] in
            self?.toasts.removeAll { $0.id == id }
        }
    }

    // MARK: - Skills

    func skill(_ id: String?) -> Skill? {
        guard let id else { return nil }
        return state.skills.first { $0.id == id }
    }

    func nextColor() -> String {
        let used = Set(state.skills.map(\.color))
        return PALETTE.first { !used.contains($0) } ?? PALETTE[state.skills.count % PALETTE.count]
    }

    @discardableResult
    func addSkill(name: String, icon: String, color: String, species: String?, quiet: Bool = false) -> Skill {
        let sk = Skill(name: name, icon: icon, color: color, species: species)
        state.skills.append(sk)
        save()
        if !quiet { toast("\(name) planted!", "pot") }
        return sk
    }

    func updateSkill(_ sk: Skill) {
        guard let i = state.skills.firstIndex(where: { $0.id == sk.id }) else { return }
        state.skills[i] = sk
        save()
    }

    func uprootSkill(_ id: String) {
        guard let sk = skill(id) else { return }
        state.skills.removeAll { $0.id == id }
        state.sessions.removeAll { $0.skillId == id }
        for i in state.tasks.indices where state.tasks[i].skillId == id { state.tasks[i].skillId = nil }
        for i in state.notes.indices where state.notes[i].skillId == id { state.notes[i].skillId = nil }
        save()
        toast("\(sk.name) uprooted", "x-circle")
    }

    // MARK: - XP / levels / streaks (progress.js)

    func xpOf(_ skillId: String) -> Int {
        state.sessions.reduce(0) { $0 + ($1.skillId == skillId ? $1.minutes : 0) }
    }

    func levelOf(_ skillId: String) -> LevelInfo { levelForXp(xpOf(skillId)) }

    func minutesOn(_ date: String, skillId: String? = nil) -> Int {
        state.sessions.reduce(0) { $0 + ($1.date == date && (skillId == nil || $1.skillId == skillId) ? $1.minutes : 0) }
    }

    func minutesTotal(_ skillId: String? = nil) -> Int {
        state.sessions.reduce(0) { $0 + (skillId == nil || $1.skillId == skillId ? $1.minutes : 0) }
    }

    func lastNDays(_ n: Int, skillId: String? = nil) -> [Int] {
        (0..<n).reversed().map { minutesOn(addDays(todayYmd(), -$0), skillId: skillId) }
    }

    func weekMinutes(_ skillId: String? = nil) -> Int {
        lastNDays(7, skillId: skillId).reduce(0, +)
    }

    func tasksDoneOn(_ date: String) -> Int {
        state.tasks.filter { t in
            guard let doneAt = t.doneAt, t.done || t.repeatRule != nil, let d = parseISO(doneAt) else { return false }
            return ymd(d) == date
        }.count
    }

    func activeOn(_ date: String) -> Bool {
        minutesOn(date) > 0 || tasksDoneOn(date) > 0
    }

    func streak() -> Int {
        var d = todayYmd()
        var n = 0
        if !activeOn(d) { d = addDays(d, -1) }   // today doesn't break it until midnight
        while activeOn(d) && n < 3650 { n += 1; d = addDays(d, -1) }
        return n
    }

    func tier(_ skillId: String? = nil) -> TierInfo {
        gardenTier(totalMinutes: minutesTotal(skillId))
    }

    // MARK: - Sessions

    func logSession(skillId: String, minutes: Int, date: String = todayYmd(), source: String = "manual", quiet: Bool = false) {
        guard let sk = skill(skillId), minutes > 0 else { return }
        let before = levelOf(skillId).level
        state.sessions.append(Session(skillId: skillId, minutes: minutes, date: date, source: source))
        save()
        if !quiet {
            if !celebrateIfLeveled(skillId, before: before) {
                toast("+\(fmtMin(minutes)) → \(sk.name) · \(fmtMin(minutesTotal(skillId))) total", sk.icon)
            }
        }
        checkKeepsakes()
    }

    @discardableResult
    func celebrateIfLeveled(_ skillId: String, before: Int) -> Bool {
        guard let sk = skill(skillId) else { return false }
        let after = levelOf(skillId).level
        if after > before {
            Sfx.shared.level()
            Haptics.levelUp()
            confettiTick += 1
            toast("\(sk.name) grew to Level \(after)!", "star")
            return true
        }
        return false
    }

    func deleteSession(_ id: String) {
        state.sessions.removeAll { $0.id == id }
        save()
    }

    /// Quick log commit: creates the plant when it's new, then logs.
    func commitQuickLog(_ p: QuickLogResult) {
        var sk = p.skill
        if sk == nil {
            // web quicklog plants carry no species key — the art defaults to bloom
            sk = addSkill(name: p.name, icon: guessIcon(p.name), color: nextColor(), species: nil, quiet: true)
            toast("New plant: \(p.name)", "pot")
        }
        logSession(skillId: sk!.id, minutes: p.minutes, date: p.date, source: "manual")
    }

    // MARK: - Keepsakes

    func checkKeepsakes() {
        let fresh = KEEPSAKES.filter { !state.keepsakes.contains($0.id) && $0.test(self) }
        guard !fresh.isEmpty else { return }
        state.keepsakes.append(contentsOf: fresh.map(\.id))
        save(silent: true)
        Sfx.shared.level()
        Haptics.levelUp()
        confettiTick += 1
        if fresh.count == 1 { toast("Keepsake earned: \(fresh[0].name)!", fresh[0].icon) }
        else { toast("\(fresh.count) keepsakes earned — see your garden shelf", "star") }
    }

    // MARK: - Tasks (tasks.js — completing gives no XP; only focused time grows plants)

    func addTask(title: String, due: String?, skillId: String?, priority: Int, repeatRule: String?) {
        let finalDue = due ?? (repeatRule != nil ? todayYmd() : nil)   // repeating tasks need a first date
        state.tasks.append(TaskItem(title: title, due: finalDue, skillId: skillId, priority: priority, repeatRule: repeatRule))
        Sfx.shared.click()
        save()
        if let d = finalDue, d != todayYmd() {
            toast("Waiting on \(fmtDate(d)) — see it in the calendar", "calendar")
        }
    }

    func toggleTask(_ id: String) {
        guard let i = state.tasks.firstIndex(where: { $0.id == id }) else { return }
        var t = state.tasks[i]
        if let rule = t.repeatRule, !t.done {
            // recurring: completing rolls the due date forward
            t.doneAt = nowISO()
            t.completions = (t.completions ?? 0) + 1
            t.due = nextOccurrence(t.due ?? todayYmd(), rule)
            state.tasks[i] = t
            save()
            Sfx.shared.pop()
            Haptics.success()
            burstTick += 1
            toast("Done — comes back \(relDue(t.due!))", "repeat")
            checkKeepsakes()
            return
        }
        t.done = !t.done
        t.doneAt = t.done ? nowISO() : nil
        state.tasks[i] = t
        save()
        if t.done {
            Sfx.shared.pop()
            Haptics.success()
            burstTick += 1
        }
        checkKeepsakes()
    }

    func updateTaskTitle(_ id: String, title: String) {
        guard let i = state.tasks.firstIndex(where: { $0.id == id }), !title.isEmpty else { return }
        state.tasks[i].title = title
        save()
    }

    func deleteTask(_ id: String) {
        state.tasks.removeAll { $0.id == id }
        save()
    }

    // MARK: - Weekly tasks

    func addWeeklyTask(_ title: String) {
        state.weeklyTasks.append(WeeklyTask(title: title, week: weekStart()))
        Sfx.shared.click()
        save()
    }

    func toggleWeeklyTask(_ id: String) {
        guard let i = state.weeklyTasks.firstIndex(where: { $0.id == id }) else { return }
        state.weeklyTasks[i].done.toggle()
        state.weeklyTasks[i].doneAt = state.weeklyTasks[i].done ? nowISO() : nil
        if state.weeklyTasks[i].done { Sfx.shared.pop(); Haptics.success() } else { Sfx.shared.click() }
        save()
    }

    func deleteWeeklyTask(_ id: String) {
        state.weeklyTasks.removeAll { $0.id == id }
        save()
    }

    // MARK: - Events (calendar.js — Google-style scoping on repeating events)

    enum RepeatScope { case one, following, all }

    func eventsOn(_ date: String) -> [BloomEvent] {
        state.events.filter { $0.occurs(on: date) }
            .sorted { a, b in
                let (ai, bi) = (a.important == true ? 1 : 0, b.important == true ? 1 : 0)
                if ai != bi { return ai > bi }
                return (a.time ?? "") < (b.time ?? "")
            }
    }

    func addEvent(_ ev: BloomEvent) {
        state.events.append(ev)
        Sfx.shared.click()
        save()
    }

    /// Edit a repeating event for one day only: skip the day, spawn a standalone copy.
    func applyEventEdit(_ id: String, changes: BloomEvent, scope: RepeatScope, on date: String) {
        guard let i = state.events.firstIndex(where: { $0.id == id }) else { return }
        if scope == .one, state.events[i].repeatRule != nil, changes.repeatRule != nil {
            state.events[i].except = (state.events[i].except ?? []) + [date]
            var copy = changes
            copy.id = uid()
            copy.repeatRule = nil
            copy.days = nil
            copy.date = date
            copy.except = []
            copy.createdAt = nowISO()
            state.events.append(copy)
        } else {
            var ev = state.events[i]
            ev.title = changes.title; ev.time = changes.time; ev.timeEnd = changes.timeEnd
            ev.color = changes.color; ev.important = changes.important
            ev.repeatRule = changes.repeatRule; ev.days = changes.days
            state.events[i] = ev
        }
        Sfx.shared.click()
        save()
    }

    func deleteEvent(_ id: String, scope: RepeatScope, on date: String) {
        guard let i = state.events.firstIndex(where: { $0.id == id }) else { return }
        let ev = state.events[i]
        if ev.repeatRule == nil || scope == .all {
            state.events.remove(at: i)
        } else if scope == .one {
            state.events[i].except = (ev.except ?? []) + [date]
            toast("Skipped for \(fmtDate(date))", "leaf")
        } else {   // this and all following days
            if date <= ev.date {
                state.events.remove(at: i)
            } else {
                state.events[i].until = addDays(date, -1)
                toast("“\(ev.title)” now ends \(fmtDate(state.events[i].until!))", "leaf")
            }
        }
        save()
    }

    /// Timeline drag-move: shift start (and end, keeping duration) to `minutes` past midnight.
    func moveEvent(_ id: String, toMinutes minutes: Int, scope: RepeatScope, on date: String) {
        guard let i = state.events.firstIndex(where: { $0.id == id }) else { return }
        let ev = state.events[i]
        var dur = 60
        if let t = ev.time, let te = ev.timeEnd {
            let p = t.split(separator: ":").compactMap { Int($0) }
            let q = te.split(separator: ":").compactMap { Int($0) }
            if p.count == 2 && q.count == 2 { dur = max(15, (q[0] * 60 + q[1]) - (p[0] * 60 + p[1])) }
        }
        let mm2hhmm = { (m: Int) in "\(pad2((m / 60) % 24)):\(pad2(m % 60))" }
        if scope == .one, ev.repeatRule != nil {
            state.events[i].except = (ev.except ?? []) + [date]
            var copy = ev
            copy.id = uid()
            copy.repeatRule = nil
            copy.days = nil
            copy.date = date
            copy.except = []
            copy.createdAt = nowISO()
            copy.time = mm2hhmm(minutes)
            if copy.timeEnd != nil { copy.timeEnd = mm2hhmm(minutes + dur) }
            state.events.append(copy)
        } else {
            state.events[i].time = mm2hhmm(minutes)
            if state.events[i].timeEnd != nil { state.events[i].timeEnd = mm2hhmm(minutes + dur) }
        }
        Sfx.shared.click()
        save()
    }

    // MARK: - Notes (notes.js)

    @discardableResult
    func addNote() -> Note {
        let n = Note(color: PALETTE[(state.notes.count * 3) % 7])
        state.notes.append(n)
        Sfx.shared.pop()
        save()
        return n
    }

    func updateNote(_ id: String, mutate: (inout Note) -> Void, silent: Bool = true) {
        guard let i = state.notes.firstIndex(where: { $0.id == id }) else { return }
        var n = state.notes[i]
        mutate(&n)
        n.updatedAt = nowISO()
        state.notes[i] = n
        save(silent: silent)
    }

    func deleteNote(_ id: String) {
        state.notes.removeAll { $0.id == id }
        save()
    }

    // MARK: - Timer engine (focus.js)

    func timerRemaining() -> Double {
        guard let t = state.timer else { return 0 }
        let now = t.pausedAt ?? Date().timeIntervalSince1970 * 1000
        return max(0, t.durationSec - (now - t.startedAt - t.pausedTotal) / 1000)
    }

    func timerElapsedSec() -> Double {
        guard let t = state.timer else { return 0 }
        return t.durationSec - timerRemaining()
    }

    func checkTimer() {
        guard let t = state.timer, t.pausedAt == nil, timerRemaining() <= 0 else { return }
        completeTimer()
    }

    func startTimer(skillId: String?, minutes: Int) {
        let workSec = Double(minutes * 60)
        state.timer = TimerState(skillId: skillId, durationSec: workSec, workSec: workSec, breakSec: 5 * 60,
                                 mode: "single", phase: "work", round: 1,
                                 startedAt: Date().timeIntervalSince1970 * 1000)
        Sfx.shared.start()
        NotificationPlanner.requestPermissionIfNeeded()
        LiveActivityController.shared.startOrUpdate(store: self)
        save()
    }

    func startBreak(minutes: Int) {
        let sec = Double(minutes * 60)
        state.timer = TimerState(skillId: nil, durationSec: sec, workSec: 0, breakSec: sec,
                                 mode: "single", phase: "break", round: 1,
                                 startedAt: Date().timeIntervalSince1970 * 1000)
        Sfx.shared.start()
        LiveActivityController.shared.startOrUpdate(store: self)
        save()
    }

    func togglePause() {
        guard var t = state.timer else { return }
        if let p = t.pausedAt {
            t.pausedTotal += Date().timeIntervalSince1970 * 1000 - p
            t.pausedAt = nil
        } else {
            t.pausedAt = Date().timeIntervalSince1970 * 1000
        }
        state.timer = t
        Sfx.shared.click()
        LiveActivityController.shared.startOrUpdate(store: self)
        save()
    }

    func skipBreak() {
        guard var t = state.timer, t.phase == "break" else { return }
        t.durationSec = 0   // next tick completes the break → next round
        t.startedAt = Date().timeIntervalSince1970 * 1000
        state.timer = t
        save()
        checkTimer()
    }

    /// End the running timer. Ending early forfeits the session — only a timer that
    /// runs all the way out earns XP, so there's nothing to bank by bailing at minute 59.
    /// (Diverges from the web, which logs the elapsed minutes.)
    func endEarly() {
        guard let t = state.timer else { return }
        if t.phase == "break" {
            state.timer = nil
            LiveActivityController.shared.end()
            save()
            toast(t.mode == "cycle" ? "Cycle ended — well grown" : "Break ended", "leaf")
            return
        }
        let elapsedMin = Int(timerElapsedSec() / 60)
        let hasPlant = skill(t.skillId) != nil
        state.timer = nil
        LiveActivityController.shared.end()
        save()
        if hasPlant && elapsedMin >= 1 {
            toast("Ended early — \(fmtMin(elapsedMin)) not logged", "hourglass")
        } else {
            toast("Timer ended", "hourglass")
        }
    }

    func completeTimer() {
        guard let t = state.timer else { return }
        let sk = skill(t.skillId)
        let name = sk?.name ?? "focus"

        if t.phase == "break" {
            if t.mode != "cycle" {
                // standalone break — just ends, nothing to log
                state.timer = nil
                LiveActivityController.shared.end()
                Sfx.shared.alarm()
                toast("Break over — fresh and ready", "leaf")
                save()
                return
            }
            // break over → next round starts by itself
            let round = t.round + 1
            state.timer = TimerState(skillId: t.skillId, durationSec: t.workSec, workSec: t.workSec, breakSec: t.breakSec,
                                     mode: "cycle", phase: "work", round: round,
                                     startedAt: Date().timeIntervalSince1970 * 1000)
            Sfx.shared.start()
            toast("Round \(round) — back to \(name)", "sprout")
            LiveActivityController.shared.startOrUpdate(store: self)
            save()
            return
        }

        // work session done
        let minutes = max(1, Int((t.durationSec / 60).rounded()))
        let skillId = t.skillId
        if t.mode == "cycle" {
            state.timer = TimerState(skillId: t.skillId, durationSec: t.breakSec, workSec: t.workSec, breakSec: t.breakSec,
                                     mode: "cycle", phase: "break", round: t.round,
                                     startedAt: Date().timeIntervalSince1970 * 1000)
            LiveActivityController.shared.startOrUpdate(store: self)
        } else {
            state.timer = nil
            LiveActivityController.shared.end()
        }
        Sfx.shared.alarm()
        Haptics.success()
        confettiTick += 1
        if let skillId, skill(skillId) != nil {
            logSession(skillId: skillId, minutes: minutes, source: "timer")   // saves + toasts + level-up celebration
        } else {
            toast("Timer done — lovely work", "hourglass")
            save()
        }
    }
}
