// Models.swift — the bloom.v1 state, mirrored field-for-field from the web app's store.js.
// Every type keeps unknown keys in `extra` so sync round-trips future/web-only fields.
// Date-ish fields stay Strings (ISO or ymd) exactly as the web stores them.
import Foundation

let PALETTE = ["#C97F5F", "#8FA35E", "#E0B54F", "#7FA98F", "#8FA9C9", "#B08FB6", "#D89B8A", "#6E8FA6", "#A9906E", "#7C8B4F"]

/// Matches web uid(): 7 chars of randomness + 4 chars of time, base36.
func uid() -> String {
    let alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    let rand = String((0..<7).map { _ in alphabet.randomElement()! })
    let ms = Int(Date().timeIntervalSince1970 * 1000)
    let time = String(ms, radix: 36)
    return rand + String(time.suffix(4))
}

// MARK: - Settings

struct BloomSettings: Codable, Equatable {
    var name: String = ""
    var theme: String = "light"          // "light" | "dark" ("auto" migrates to light, like the web)
    var sound: Bool = true
    var music: Bool = true
    var ringer: String = "chime"
    var hour24: Bool = false
    var onboarded: Bool = false
    var reminder: Bool = false
    var reminderTime: String = "19:00"
    var reminderLast: String? = nil
    var taps: Bool = true
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["name", "theme", "sound", "music", "ringer", "hour24", "onboarded", "reminder", "reminderTime", "reminderLast", "taps"]

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        name = (try? c.decode(String.self, forKey: AnyKey("name"))) ?? ""
        theme = (try? c.decode(String.self, forKey: AnyKey("theme"))) ?? "light"
        if theme == "auto" { theme = "light" }
        sound = (try? c.decode(Bool.self, forKey: AnyKey("sound"))) ?? true
        music = (try? c.decode(Bool.self, forKey: AnyKey("music"))) ?? true
        ringer = (try? c.decode(String.self, forKey: AnyKey("ringer"))) ?? "chime"
        hour24 = (try? c.decode(Bool.self, forKey: AnyKey("hour24"))) ?? false
        onboarded = (try? c.decode(Bool.self, forKey: AnyKey("onboarded"))) ?? false
        reminder = (try? c.decode(Bool.self, forKey: AnyKey("reminder"))) ?? false
        reminderTime = (try? c.decode(String.self, forKey: AnyKey("reminderTime"))) ?? "19:00"
        reminderLast = try? c.decode(String.self, forKey: AnyKey("reminderLast"))
        taps = (try? c.decode(Bool.self, forKey: AnyKey("taps"))) ?? true
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(name, forKey: AnyKey("name"))
        try c.encode(theme, forKey: AnyKey("theme"))
        try c.encode(sound, forKey: AnyKey("sound"))
        try c.encode(music, forKey: AnyKey("music"))
        try c.encode(ringer, forKey: AnyKey("ringer"))
        try c.encode(hour24, forKey: AnyKey("hour24"))
        try c.encode(onboarded, forKey: AnyKey("onboarded"))
        try c.encode(reminder, forKey: AnyKey("reminder"))
        try c.encode(reminderTime, forKey: AnyKey("reminderTime"))
        try c.encode(reminderLast, forKey: AnyKey("reminderLast"))
        try c.encode(taps, forKey: AnyKey("taps"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Skill

struct Skill: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var icon: String = "sprout"
    var color: String
    var species: String? = nil           // absent on the web until picked — stays absent
    var createdAt: String
    var extra: [String: JSONValue] = [:]

    /// plant.js: SPECIES[skill.species] || SPECIES.bloom
    var speciesOrDefault: String { species ?? "bloom" }

    static let known: Set<String> = ["id", "name", "icon", "color", "species", "createdAt"]

    // web migration table: emoji era → line-icon era
    static let emojiToIcon: [String: String] = ["📐": "calc", "📚": "book", "💻": "code", "🗣️": "globe", "🎹": "music", "🎸": "music", "🎵": "music", "💪": "dumbbell", "🏃‍♀️": "ball", "🧘‍♀️": "heart", "🎨": "palette", "✍️": "pencil", "🔬": "flask", "🎓": "cap", "🍳": "pan", "🎮": "gamepad", "💼": "briefcase", "🎬": "film", "💃": "star", "🏊‍♀️": "ball", "♟️": "target", "📷": "camera", "🧠": "star", "🌿": "sprout"]

    init(id: String = uid(), name: String, icon: String = "sprout", color: String, species: String? = nil, createdAt: String = nowISO()) {
        self.id = id; self.name = name; self.icon = icon; self.color = color; self.species = species; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        name = (try? c.decode(String.self, forKey: AnyKey("name"))) ?? ""
        color = (try? c.decode(String.self, forKey: AnyKey("color"))) ?? PALETTE[0]
        species = try? c.decode(String.self, forKey: AnyKey("species"))
        createdAt = (try? c.decode(String.self, forKey: AnyKey("createdAt"))) ?? nowISO()
        extra = c.extras(known: Self.known)
        if let ic = try? c.decode(String.self, forKey: AnyKey("icon")) {
            icon = ic
        } else if case .string(let emoji)? = extra["emoji"], let mapped = Self.emojiToIcon[emoji] {
            icon = mapped   // same migration the web does on load
        } else {
            icon = "sprout"
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(name, forKey: AnyKey("name"))
        try c.encode(icon, forKey: AnyKey("icon"))
        try c.encode(color, forKey: AnyKey("color"))
        if let sp = species { try c.encode(sp, forKey: AnyKey("species")) }
        try c.encode(createdAt, forKey: AnyKey("createdAt"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Task

struct TaskItem: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var done: Bool = false
    var doneAt: String? = nil
    var due: String? = nil               // ymd
    var skillId: String? = nil
    var priority: Int = 0                // 0 | 1 | 2
    var repeatRule: String? = nil        // "daily" | "weekly" | "monthly" (web key: repeat)
    var completions: Int? = nil
    var createdAt: String
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["id", "title", "done", "doneAt", "due", "skillId", "priority", "repeat", "completions", "createdAt"]

    init(id: String = uid(), title: String, due: String? = nil, skillId: String? = nil, priority: Int = 0, repeatRule: String? = nil, createdAt: String = nowISO()) {
        self.id = id; self.title = title; self.due = due; self.skillId = skillId; self.priority = priority
        self.repeatRule = repeatRule
        self.completions = repeatRule != nil ? 0 : nil
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        title = (try? c.decode(String.self, forKey: AnyKey("title"))) ?? ""
        done = (try? c.decode(Bool.self, forKey: AnyKey("done"))) ?? false
        doneAt = try? c.decode(String.self, forKey: AnyKey("doneAt"))
        due = try? c.decode(String.self, forKey: AnyKey("due"))
        skillId = try? c.decode(String.self, forKey: AnyKey("skillId"))
        priority = (try? c.decode(Int.self, forKey: AnyKey("priority"))) ?? 0
        repeatRule = try? c.decode(String.self, forKey: AnyKey("repeat"))
        completions = try? c.decode(Int.self, forKey: AnyKey("completions"))
        createdAt = (try? c.decode(String.self, forKey: AnyKey("createdAt"))) ?? nowISO()
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(title, forKey: AnyKey("title"))
        try c.encode(done, forKey: AnyKey("done"))
        try c.encode(doneAt, forKey: AnyKey("doneAt"))
        try c.encode(due, forKey: AnyKey("due"))
        try c.encode(skillId, forKey: AnyKey("skillId"))
        try c.encode(priority, forKey: AnyKey("priority"))
        if let r = repeatRule { try c.encode(r, forKey: AnyKey("repeat")) }
        if let n = completions { try c.encode(n, forKey: AnyKey("completions")) }
        try c.encode(createdAt, forKey: AnyKey("createdAt"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Weekly task

struct WeeklyTask: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var done: Bool = false
    var doneAt: String? = nil
    var week: String                     // Monday ymd of its week
    var createdAt: String
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["id", "title", "done", "doneAt", "week", "createdAt"]

    init(id: String = uid(), title: String, week: String, createdAt: String = nowISO()) {
        self.id = id; self.title = title; self.week = week; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        title = (try? c.decode(String.self, forKey: AnyKey("title"))) ?? ""
        done = (try? c.decode(Bool.self, forKey: AnyKey("done"))) ?? false
        doneAt = try? c.decode(String.self, forKey: AnyKey("doneAt"))
        week = (try? c.decode(String.self, forKey: AnyKey("week"))) ?? ""
        createdAt = (try? c.decode(String.self, forKey: AnyKey("createdAt"))) ?? nowISO()
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(title, forKey: AnyKey("title"))
        try c.encode(done, forKey: AnyKey("done"))
        try c.encode(doneAt, forKey: AnyKey("doneAt"))
        try c.encode(week, forKey: AnyKey("week"))
        try c.encode(createdAt, forKey: AnyKey("createdAt"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Event

struct BloomEvent: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var date: String                     // ymd of the first occurrence
    var time: String? = nil              // "HH:MM"
    var timeEnd: String? = nil
    var color: String = "#D89B8A"
    var skillId: String? = nil
    var important: Bool? = nil           // starred events sort first
    var repeatRule: String? = nil        // daily | weekly | monthly | days
    var days: [Int]? = nil               // for repeat == "days" (0=Sun)
    var except: [String]? = nil          // per-day skips
    var until: String? = nil             // series end
    var createdAt: String
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["id", "title", "date", "time", "timeEnd", "color", "skillId", "important", "repeat", "days", "except", "until", "createdAt"]

    init(id: String = uid(), title: String, date: String, time: String? = nil, timeEnd: String? = nil,
         color: String = "#D89B8A", important: Bool? = nil, repeatRule: String? = nil, days: [Int]? = nil,
         except: [String]? = [], createdAt: String = nowISO()) {
        self.id = id; self.title = title; self.date = date; self.time = time; self.timeEnd = timeEnd
        self.color = color; self.important = important; self.repeatRule = repeatRule; self.days = days
        self.except = except; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        title = (try? c.decode(String.self, forKey: AnyKey("title"))) ?? ""
        date = (try? c.decode(String.self, forKey: AnyKey("date"))) ?? ""
        time = try? c.decode(String.self, forKey: AnyKey("time"))
        timeEnd = try? c.decode(String.self, forKey: AnyKey("timeEnd"))
        color = (try? c.decode(String.self, forKey: AnyKey("color"))) ?? "#D89B8A"
        if color == "#9B7DF2" { color = "#D89B8A" }   // web's violet-era retint
        skillId = try? c.decode(String.self, forKey: AnyKey("skillId"))
        important = try? c.decode(Bool.self, forKey: AnyKey("important"))
        repeatRule = try? c.decode(String.self, forKey: AnyKey("repeat"))
        days = try? c.decode([Int].self, forKey: AnyKey("days"))
        except = try? c.decode([String].self, forKey: AnyKey("except"))
        until = try? c.decode(String.self, forKey: AnyKey("until"))
        createdAt = (try? c.decode(String.self, forKey: AnyKey("createdAt"))) ?? nowISO()
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(title, forKey: AnyKey("title"))
        try c.encode(date, forKey: AnyKey("date"))
        if let t = time { try c.encode(t, forKey: AnyKey("time")) } else { try c.encodeNil(forKey: AnyKey("time")) }
        if let t = timeEnd { try c.encode(t, forKey: AnyKey("timeEnd")) }
        try c.encode(color, forKey: AnyKey("color"))
        try c.encode(skillId, forKey: AnyKey("skillId"))
        if let imp = important { try c.encode(imp, forKey: AnyKey("important")) }
        if let r = repeatRule { try c.encode(r, forKey: AnyKey("repeat")) }
        if let d = days { try c.encode(d, forKey: AnyKey("days")) }
        if let e = except { try c.encode(e, forKey: AnyKey("except")) }
        if let u = until { try c.encode(u, forKey: AnyKey("until")) }
        try c.encode(createdAt, forKey: AnyKey("createdAt"))
        try c.encodeExtras(extra)
    }

    /// util.js eventOccursOn
    func occurs(on d: String) -> Bool {
        if let except, except.contains(d) { return false }
        guard let repeatRule else { return date == d }
        if d < date { return false }
        if let until, d > until { return false }
        switch repeatRule {
        case "daily": return true
        case "weekly": return weekday(of: d) == weekday(of: date)
        case "monthly": return d.suffix(2) == date.suffix(2)
        case "days": return days?.contains(weekday(of: d)) ?? false
        default: return false
        }
    }
}

// MARK: - Note (carried through sync; Notes view arrives later)

struct Note: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var body: String
    var skillId: String? = nil
    var color: String = "#D89B8A"
    var pinned: Bool = false
    var createdAt: String
    var updatedAt: String
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["id", "title", "body", "skillId", "color", "pinned", "createdAt", "updatedAt"]

    init(id: String = uid(), title: String = "", body: String = "", skillId: String? = nil,
         color: String = "#D89B8A", pinned: Bool = false, createdAt: String = nowISO(), updatedAt: String = nowISO()) {
        self.id = id; self.title = title; self.body = body; self.skillId = skillId
        self.color = color; self.pinned = pinned; self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        title = (try? c.decode(String.self, forKey: AnyKey("title"))) ?? ""
        body = (try? c.decode(String.self, forKey: AnyKey("body"))) ?? ""
        skillId = try? c.decode(String.self, forKey: AnyKey("skillId"))
        color = (try? c.decode(String.self, forKey: AnyKey("color"))) ?? "#D89B8A"
        if color == "#9B7DF2" { color = "#D89B8A" }
        pinned = (try? c.decode(Bool.self, forKey: AnyKey("pinned"))) ?? false
        createdAt = (try? c.decode(String.self, forKey: AnyKey("createdAt"))) ?? nowISO()
        updatedAt = (try? c.decode(String.self, forKey: AnyKey("updatedAt"))) ?? nowISO()
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(title, forKey: AnyKey("title"))
        try c.encode(body, forKey: AnyKey("body"))
        try c.encode(skillId, forKey: AnyKey("skillId"))
        try c.encode(color, forKey: AnyKey("color"))
        try c.encode(pinned, forKey: AnyKey("pinned"))
        try c.encode(createdAt, forKey: AnyKey("createdAt"))
        try c.encode(updatedAt, forKey: AnyKey("updatedAt"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Session

struct Session: Codable, Equatable, Identifiable {
    var id: String
    var skillId: String? = nil
    var minutes: Int
    var date: String                     // ymd it counts toward
    var source: String = "manual"        // "manual" | "timer"
    var at: String                       // ISO timestamp it was logged
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["id", "skillId", "minutes", "date", "source", "at"]

    init(id: String = uid(), skillId: String?, minutes: Int, date: String, source: String, at: String = nowISO()) {
        self.id = id; self.skillId = skillId; self.minutes = minutes; self.date = date; self.source = source; self.at = at
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = (try? c.decode(String.self, forKey: AnyKey("id"))) ?? uid()
        skillId = try? c.decode(String.self, forKey: AnyKey("skillId"))
        minutes = (try? c.decode(Int.self, forKey: AnyKey("minutes"))) ?? Int(((try? c.decode(Double.self, forKey: AnyKey("minutes"))) ?? 0).rounded())
        date = (try? c.decode(String.self, forKey: AnyKey("date"))) ?? ""
        source = (try? c.decode(String.self, forKey: AnyKey("source"))) ?? "manual"
        at = (try? c.decode(String.self, forKey: AnyKey("at"))) ?? nowISO()
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(skillId, forKey: AnyKey("skillId"))
        try c.encode(minutes, forKey: AnyKey("minutes"))
        try c.encode(date, forKey: AnyKey("date"))
        try c.encode(source, forKey: AnyKey("source"))
        try c.encode(at, forKey: AnyKey("at"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Timer (persisted in state, so a running timer syncs across devices)

struct TimerState: Codable, Equatable {
    var skillId: String? = nil           // nil = free focus / standalone break
    var durationSec: Double
    var workSec: Double
    var breakSec: Double
    var mode: String = "single"          // "single" | "cycle"
    var phase: String = "work"           // "work" | "break"
    var round: Int = 1
    var startedAt: Double                // ms epoch, exactly like Date.now()
    var pausedAt: Double? = nil          // ms epoch while paused
    var pausedTotal: Double = 0          // accumulated paused ms
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["skillId", "durationSec", "workSec", "breakSec", "mode", "phase", "round", "startedAt", "pausedAt", "pausedTotal"]

    init(skillId: String?, durationSec: Double, workSec: Double, breakSec: Double, mode: String, phase: String, round: Int, startedAt: Double, pausedAt: Double? = nil, pausedTotal: Double = 0) {
        self.skillId = skillId; self.durationSec = durationSec; self.workSec = workSec; self.breakSec = breakSec
        self.mode = mode; self.phase = phase; self.round = round
        self.startedAt = startedAt; self.pausedAt = pausedAt; self.pausedTotal = pausedTotal
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        skillId = try? c.decode(String.self, forKey: AnyKey("skillId"))
        durationSec = (try? c.decode(Double.self, forKey: AnyKey("durationSec"))) ?? 0
        workSec = (try? c.decode(Double.self, forKey: AnyKey("workSec"))) ?? durationSec
        breakSec = (try? c.decode(Double.self, forKey: AnyKey("breakSec"))) ?? 300
        mode = (try? c.decode(String.self, forKey: AnyKey("mode"))) ?? "single"
        phase = (try? c.decode(String.self, forKey: AnyKey("phase"))) ?? "work"
        round = (try? c.decode(Int.self, forKey: AnyKey("round"))) ?? 1
        startedAt = (try? c.decode(Double.self, forKey: AnyKey("startedAt"))) ?? 0
        pausedAt = try? c.decode(Double.self, forKey: AnyKey("pausedAt"))
        pausedTotal = (try? c.decode(Double.self, forKey: AnyKey("pausedTotal"))) ?? 0
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(skillId, forKey: AnyKey("skillId"))
        try c.encode(durationSec, forKey: AnyKey("durationSec"))
        try c.encode(workSec, forKey: AnyKey("workSec"))
        try c.encode(breakSec, forKey: AnyKey("breakSec"))
        try c.encode(mode, forKey: AnyKey("mode"))
        try c.encode(phase, forKey: AnyKey("phase"))
        try c.encode(round, forKey: AnyKey("round"))
        try c.encode(startedAt, forKey: AnyKey("startedAt"))
        if let p = pausedAt { try c.encode(p, forKey: AnyKey("pausedAt")) } else { try c.encodeNil(forKey: AnyKey("pausedAt")) }
        try c.encode(pausedTotal, forKey: AnyKey("pausedTotal"))
        try c.encodeExtras(extra)
    }
}

// MARK: - Whole state

struct BloomState: Codable, Equatable {
    var version: Int = 1
    var settings = BloomSettings()
    var skills: [Skill] = []
    var tasks: [TaskItem] = []
    var weeklyTasks: [WeeklyTask] = []
    var events: [BloomEvent] = []
    var notes: [Note] = []
    var sessions: [Session] = []
    var keepsakes: [String] = []
    var timer: TimerState? = nil
    var editedAt: String? = nil
    var extra: [String: JSONValue] = [:]

    static let known: Set<String> = ["version", "settings", "skills", "tasks", "weeklyTasks", "events", "notes", "sessions", "keepsakes", "timer", "editedAt"]

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        version = (try? c.decode(Int.self, forKey: AnyKey("version"))) ?? 1
        settings = (try? c.decode(BloomSettings.self, forKey: AnyKey("settings"))) ?? BloomSettings()
        skills = (try? c.decode([Skill].self, forKey: AnyKey("skills"))) ?? []
        tasks = (try? c.decode([TaskItem].self, forKey: AnyKey("tasks"))) ?? []
        weeklyTasks = (try? c.decode([WeeklyTask].self, forKey: AnyKey("weeklyTasks"))) ?? []
        events = (try? c.decode([BloomEvent].self, forKey: AnyKey("events"))) ?? []
        notes = (try? c.decode([Note].self, forKey: AnyKey("notes"))) ?? []
        sessions = (try? c.decode([Session].self, forKey: AnyKey("sessions"))) ?? []
        keepsakes = (try? c.decode([String].self, forKey: AnyKey("keepsakes"))) ?? []
        timer = try? c.decode(TimerState.self, forKey: AnyKey("timer"))
        editedAt = try? c.decode(String.self, forKey: AnyKey("editedAt"))
        extra = c.extras(known: Self.known)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(version, forKey: AnyKey("version"))
        try c.encode(settings, forKey: AnyKey("settings"))
        try c.encode(skills, forKey: AnyKey("skills"))
        try c.encode(tasks, forKey: AnyKey("tasks"))
        try c.encode(weeklyTasks, forKey: AnyKey("weeklyTasks"))
        try c.encode(events, forKey: AnyKey("events"))
        try c.encode(notes, forKey: AnyKey("notes"))
        try c.encode(sessions, forKey: AnyKey("sessions"))
        try c.encode(keepsakes, forKey: AnyKey("keepsakes"))
        if let t = timer { try c.encode(t, forKey: AnyKey("timer")) } else { try c.encodeNil(forKey: AnyKey("timer")) }
        if let e = editedAt { try c.encode(e, forKey: AnyKey("editedAt")) } else { try c.encodeNil(forKey: AnyKey("editedAt")) }
        try c.encodeExtras(extra)
    }

    /// cloud.js substance(): how much real life a garden holds.
    var substance: Int {
        skills.count + sessions.count + tasks.count + notes.count + events.count + (settings.name.isEmpty ? 0 : 1)
    }
}
