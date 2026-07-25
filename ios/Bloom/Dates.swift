// Dates.swift — util.js date helpers, ported faithfully. Local dates only:
// ymd strings are computed in the user's timezone, never via UTC (which shifts the day).
import Foundation

@inline(__always) func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

private var cal: Calendar { Calendar.current }

func ymd(_ d: Date) -> String {
    let c = cal.dateComponents([.year, .month, .day], from: d)
    return "\(c.year!)-\(pad2(c.month!))-\(pad2(c.day!))"
}

/// Noon local, like the web's fromYmd — DST can never shift the day.
func fromYmd(_ s: String) -> Date {
    let p = s.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return Date() }
    return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) ?? Date()
}

func todayYmd() -> String { ymd(Date()) }

func addDays(_ s: String, _ n: Int) -> String {
    ymd(cal.date(byAdding: .day, value: n, to: fromYmd(s)) ?? fromYmd(s))
}

func dayDiff(_ a: String, _ b: String) -> Int {
    Int((fromYmd(b).timeIntervalSince(fromYmd(a)) / 86400).rounded())
}

/// 0 = Sunday … 6 = Saturday, matching JS getDay().
func weekday(of s: String) -> Int {
    (cal.component(.weekday, from: fromYmd(s)) - 1)
}

/// Monday of the week containing s.
func weekStart(_ s: String = todayYmd()) -> String {
    addDays(s, -((weekday(of: s) + 6) % 7))
}

let DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
let DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
let MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

func fmtDate(_ s: String) -> String {
    let d = fromYmd(s)
    let m = cal.component(.month, from: d) - 1
    return "\(DAY_NAMES_SHORT[weekday(of: s)]), \(MONTH_NAMES[m].prefix(3)) \(cal.component(.day, from: d))"
}

func fmtDateShort(_ s: String) -> String {
    let d = fromYmd(s)
    return "\(MONTH_NAMES[cal.component(.month, from: d) - 1].prefix(3)) \(cal.component(.day, from: d))"
}

func fmtLongDate(_ s: String) -> String {
    let d = fromYmd(s)
    return "\(DAY_NAMES_LONG[weekday(of: s)]), \(MONTH_NAMES[cal.component(.month, from: d) - 1]) \(cal.component(.day, from: d))"
}

func fmtMin(_ min: Int) -> String {
    let h = min / 60, m = min % 60
    return h > 0 ? (m > 0 ? "\(h)h \(m)m" : "\(h)h") : "\(m)m"
}

func fmtClock(_ sec: Double) -> String {
    let s = max(0, Int(sec.rounded(.up)))
    let h = s / 3600, m = (s % 3600) / 60, ss = s % 60
    return h > 0 ? "\(h):\(pad2(m)):\(pad2(ss))" : "\(m):\(pad2(ss))"
}

func relDue(_ s: String) -> String {
    let diff = dayDiff(todayYmd(), s)
    if diff == 0 { return "today" }
    if diff == 1 { return "tomorrow" }
    if diff == -1 { return "1 day late" }
    if diff < 0 { return "\(-diff) days late" }
    if diff < 7 { return DAY_NAMES_SHORT[weekday(of: s)] }
    return fmtDateShort(s)
}

/// "HH:MM" → "3:00 pm" (or untouched in 24h mode)
func fmtTime(_ hhmm: String?, h24: Bool) -> String {
    guard let hhmm, !hhmm.isEmpty else { return "" }
    if h24 { return hhmm }
    let p = hhmm.split(separator: ":").compactMap { Int($0) }
    guard p.count == 2 else { return hhmm }
    var h = p[0]
    let ap = h >= 12 ? "pm" : "am"
    h = h % 12
    if h == 0 { h = 12 }
    return "\(h):\(pad2(p[1])) \(ap)"
}

func relTime(_ iso: String) -> String {
    guard let d = parseISO(iso) else { return "" }
    let min = Int(Date().timeIntervalSince(d) / 60)
    if min < 1 { return "just now" }
    if min < 60 { return "\(min)m ago" }
    let h = min / 60
    if h < 24 { return "\(h)h ago" }
    return fmtDateShort(ymd(d))
}

// MARK: - ISO timestamps (JS toISOString format, so string comparisons match the web)

private let isoWriter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
    return f
}()

func nowISO() -> String { isoWriter.string(from: Date()) }

func parseISO(_ s: String) -> Date? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
}

/// util.js nextOccurrence — recurring tasks roll their due date forward.
func nextOccurrence(_ date: String, _ repeatRule: String) -> String {
    switch repeatRule {
    case "daily": return addDays(date, 1)
    case "weekly": return addDays(date, 7)
    case "monthly":
        // Calendar clamps Jan 31 + 1mo to Feb 28 on its own — same end result as the
        // web's setMonth-overflow-then-setDate(0) dance.
        guard let pushed = cal.date(byAdding: .month, value: 1, to: fromYmd(date)) else { return date }
        return ymd(pushed)
    default: return date
    }
}

// MARK: - Time input parsing (util.js parseTimeInput)

/// "7pm" / "7:30 pm" / "19:30" / "930pm" → "HH:MM". nil = blank (all-day); "invalid" throws ParseFail.
enum TimeParse: Equatable {
    case blank
    case time(String)     // "HH:MM"
    case invalid
}

func parseTimeInput(_ str: String) -> TimeParse {
    let t = str.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if t.isEmpty { return .blank }
    // separator optional: "1030" and "930pm" are still times
    guard let re = try? NSRegularExpression(pattern: "^(\\d{1,2})(?:[:.]?(\\d{2}))?\\s*(am|pm|a|p)?\\.?$"),
          let m = re.firstMatch(in: t, range: NSRange(t.startIndex..., in: t))
    else { return .invalid }
    let ns = t as NSString
    var h = Int(ns.substring(with: m.range(at: 1))) ?? 0
    let min = m.range(at: 2).location != NSNotFound ? (Int(ns.substring(with: m.range(at: 2))) ?? 0) : 0
    let ap = m.range(at: 3).location != NSNotFound ? ns.substring(with: m.range(at: 3)) : nil
    if min > 59 { return .invalid }
    if let ap {
        if h < 1 || h > 12 { return .invalid }
        if ap.hasPrefix("p") && h != 12 { h += 12 }
        if ap.hasPrefix("a") && h == 12 { h = 0 }
    } else if h > 23 {
        return .invalid
    }
    return .time("\(pad2(h)):\(pad2(min))")
}

/// util.js repeatLabel — 'daily' / 'weekly' / 'monthly' / 'Tue, Thu' / 'weekdays'
func repeatLabel(repeatRule: String?, days: [Int]?) -> String {
    guard let repeatRule else { return "" }
    if repeatRule != "days" { return repeatRule }
    let d = (days ?? []).sorted()
    if d.count == 7 { return "daily" }
    if d.count == 5 && d.allSatisfy({ $0 >= 1 && $0 <= 5 }) { return "weekdays" }
    if d.count == 2 && d.contains(0) && d.contains(6) { return "weekends" }
    return d.map { DAY_NAMES_SHORT[$0] }.joined(separator: ", ")
}
