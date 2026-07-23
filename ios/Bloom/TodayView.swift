// TodayView.swift — the dashboard: greeting, daily quote, stats, today's plan
// (events + tasks), weekly checklist, quick log, garden peek, focus chart.
import SwiftUI

private let QUOTES: [(String, String?)] = [
    ("Little by little, a little becomes a lot.", "Tanzanian proverb"),
    ("The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese proverb"),
    ("Nature does not hurry, yet everything is accomplished.", "Lao Tzu"),
    ("Small steps, every day — that's how gardens grow.", nil),
    ("The secret of getting ahead is getting started.", "Mark Twain"),
    ("Great things are done by a series of small things brought together.", "Vincent van Gogh"),
    ("We are what we repeatedly do.", "Will Durant"),
    ("No rain, no flowers.", nil),
    ("Well begun is half done.", "Aristotle"),
    ("Your plants are rooting for you.", nil),
    ("Don't watch the clock; do what it does. Keep going.", "Sam Levenson"),
    ("Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"),
    ("Where flowers bloom, so does hope.", "Lady Bird Johnson"),
    ("One focused hour beats a busy day.", nil),
    ("A year from now you may wish you had started today.", "Karen Lamb"),
    ("How we spend our days is how we spend our lives.", "Annie Dillard"),
    ("It always seems impossible until it's done.", "Nelson Mandela"),
    ("Every flower must grow through dirt.", nil),
    ("You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"),
    ("Water something today — future you says thanks.", nil),
    ("A river cuts through rock not because of its power, but its persistence.", "Jim Watkins"),
    ("Motivation gets you going; habit gets you there.", "Zig Ziglar"),
    ("What are you growing today?", nil),
    ("Diligence is the mother of good luck.", "Benjamin Franklin"),
]

struct TodayView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    var openSettings: () -> Void
    var switchTab: (Tab) -> Void

    @State private var quickTaskText = ""
    @State private var weekTaskText = ""
    @State private var chartRange = "week"

    private var greeting: (String, String) {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 5 { return ("Night owl mode", "moon") }
        if h < 12 { return ("Good morning", "sun") }
        if h < 18 { return ("Good afternoon", "sun") }
        return ("Good evening", "moon")
    }

    private var dailyQuote: (String, String?) {
        let day = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
        return QUOTES[day % QUOTES.count]
    }

    var body: some View {
        let today = todayYmd()
        let (greet, gIcon) = greeting
        let name = store.state.settings.name.isEmpty ? "friend" : store.state.settings.name

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header(greet: greet, gIcon: gIcon, name: name)
                statsRow(today: today)
                planCard(today: today)
                quickLogCard
                weekCard
                focusChartCard
                gardenPeek
                upNextCard(today: today)
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: header

    private func header(greet: String, gIcon: String, name: String) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    (Text("\(greet), ").font(.display(26))
                        + Text(name).font(.displayItalic(26)).foregroundColor(theme.olive2))
                        .foregroundColor(theme.inkStrong)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                    Ic(name: gIcon, size: 20).foregroundColor(theme.olive)
                }
                .onTapGesture(perform: openSettings)
                Text(fmtLongDate(todayYmd())).font(.quicksand(13)).foregroundColor(theme.muted)
                let (quote, by) = dailyQuote
                (Text("“\(quote)”").font(.displayItalic(12.5))
                    + Text(by.map { " — \($0)" } ?? "").font(.quicksand(11.5)))
                    .foregroundColor(theme.muted)
                    .padding(.top, 2)
            }
            Spacer()
            Button { openSettings() } label: {
                Ic(name: "gear", size: 16).foregroundColor(theme.muted)
                    .padding(8)
                    .background(Circle().fill(theme.card))
                    .overlay(Circle().stroke(theme.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private func statsRow(today: String) -> some View {
        let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: cols, spacing: 10) {
            StatTile(icon: "flame", tile: theme.peachSoft, num: String(store.streak()), label: "day streak")
            StatTile(icon: "stopwatch", tile: theme.mintSoft, num: fmtMin(store.minutesOn(today)), label: "focused today")
            StatTile(icon: "check", tile: theme.greenSoft, num: String(store.tasksDoneOn(today)), label: "tasks done today")
            StatTile(icon: "sprout", tile: theme.sunSoft, num: fmtMin(store.weekMinutes()), label: "grown this week")
        }
    }

    // MARK: today's plan (events read-only + tasks due today)

    private func planCard(today: String) -> some View {
        let planTasks = store.state.tasks
            .filter { !$0.done && $0.due == today }
            .sorted { a, b in a.priority != b.priority ? a.priority > b.priority : a.createdAt < b.createdAt }
        let eventsToday = store.state.events
            .filter { $0.occurs(on: today) }
            .sorted { ($0.time ?? "") < ($1.time ?? "") }

        return VStack(alignment: .leading, spacing: 13) {
            HStack {
                BloomTitle(prefix: "Today's ", em: "plan", icon: "clipboard")
                Spacer()
            }
            ForEach(eventsToday) { ev in
                EventRow(event: ev, timeText: ev.time == nil ? "all day"
                         : fmtTime(ev.time, h24: store.state.settings.hour24) + (ev.timeEnd != nil ? " – \(fmtTime(ev.timeEnd, h24: store.state.settings.hour24))" : ""))
            }
            if planTasks.isEmpty && eventsToday.isEmpty {
                EmptyState(icon: "leaf", text: "Nothing due today — a fresh page.")
            }
            ForEach(planTasks) { t in
                TaskRow(store: store, task: t, showDue: false)
            }
            TextField("＋ Add a task for today…", text: $quickTaskText)
                .textFieldStyle(BloomFieldStyle())
                .onSubmit {
                    let v = quickTaskText.trimmingCharacters(in: .whitespaces)
                    guard !v.isEmpty else { return }
                    store.addTask(title: v, due: today, skillId: nil, priority: 0, repeatRule: nil)
                    quickTaskText = ""
                }
        }
        .card()
    }

    // MARK: quick log

    private var quickLogCard: some View {
        VStack(alignment: .leading, spacing: 13) {
            BloomTitle(prefix: "Add ", em: "time", icon: "bolt")
            QuickLogBox(store: store)
        }
        .card()
    }

    // MARK: weekly checklist

    private var weekCard: some View {
        let wk = weekStart()
        let tasks = store.state.weeklyTasks
            .filter { $0.week == wk }
            .sorted { (($0.done ? 1 : 0), $0.createdAt) < (($1.done ? 1 : 0), $1.createdAt) }
        let done = tasks.filter(\.done).count

        return VStack(alignment: .leading, spacing: 11) {
            HStack {
                BloomTitle(prefix: "This ", em: "week", icon: "check-square")
                Spacer()
                if !tasks.isEmpty { Chip(text: "\(done)/\(tasks.count)", style: .lilac) }
            }
            if tasks.isEmpty {
                Text("What do you want to get done this week?")
                    .font(.quicksand(13)).foregroundColor(theme.muted)
            }
            ForEach(tasks) { t in
                HStack(spacing: 10) {
                    CheckButton(checked: t.done) { store.toggleWeeklyTask(t.id) }
                    Text(t.title)
                        .font(.quicksand(14))
                        .strikethrough(t.done)
                        .foregroundColor(t.done ? theme.muted : theme.ink)
                    Spacer()
                    Button { store.deleteWeeklyTask(t.id) } label: {
                        Ic(name: "trash", size: 13).foregroundColor(theme.muted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 5)
            }
            TextField("＋ Add something for this week…", text: $weekTaskText)
                .textFieldStyle(BloomFieldStyle())
                .onSubmit {
                    let v = weekTaskText.trimmingCharacters(in: .whitespaces)
                    guard !v.isEmpty else { return }
                    store.addWeeklyTask(v)
                    weekTaskText = ""
                }
        }
        .card()
    }

    // MARK: focus chart

    private var focusChartCard: some View {
        let today = todayYmd()
        var values: [Int] = []
        var labels: [String] = []
        if chartRange == "week" {
            values = store.lastNDays(7)
            labels = dayLabels7()
        } else if chartRange == "month" {
            values = store.lastNDays(30)
            labels = (0..<30).reversed().map { i in
                let d = addDays(today, -i)
                return i % 5 == 0 ? String(Int(d.suffix(2)) ?? 0) : ""
            }
        } else {
            let calNow = Date()
            var byMonth: [(String, Int)] = []
            for i in (0..<12).reversed() {
                let d = Calendar.current.date(byAdding: .month, value: -i, to: calNow)!
                let key = String(ymd(d).prefix(7))
                byMonth.append((key, 0))
                labels.append(String(MONTH_NAMES[Calendar.current.component(.month, from: d) - 1].prefix(1)))
            }
            for sess in store.state.sessions {
                let key = String(sess.date.prefix(7))
                if let i = byMonth.firstIndex(where: { $0.0 == key }) { byMonth[i].1 += sess.minutes }
            }
            values = byMonth.map(\.1)
        }
        let total = values.reduce(0, +)

        return VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 6) {
                BloomTitle(prefix: "Your ", em: "focus", icon: "bars")
                Spacer()
                ForEach(["week", "month", "year"], id: \.self) { r in
                    Button { chartRange = r; Sfx.shared.click() } label: {
                        Chip(text: r, selected: chartRange == r)
                    }
                    .buttonStyle(.plain)
                }
            }
            BarChart(values: values, labels: labels)
            Text(total > 0 ? "\(fmtMin(total)) focused this \(chartRange)" : "nothing this \(chartRange) yet — the bars are waiting")
                .font(.quicksand(12)).foregroundColor(theme.muted)
        }
        .card()
    }

    // MARK: garden peek

    private var gardenPeek: some View {
        let topSkills = store.state.skills
            .sorted {
                let (a, b) = (store.weekMinutes($0.id), store.weekMinutes($1.id))
                return a != b ? a > b : store.xpOf($0.id) > store.xpOf($1.id)
            }
            .prefix(3)

        return VStack(alignment: .leading, spacing: 13) {
            HStack {
                BloomTitle(prefix: "Garden ", em: "peek", icon: "sprout")
                Spacer()
                Button { switchTab(.garden) } label: {
                    Text("garden →").font(.quicksandBold(12)).foregroundColor(theme.olive2)
                }
                .buttonStyle(.plain)
            }
            if topSkills.isEmpty {
                EmptyState(icon: "pot", text: "No plants yet — add some time above or visit the garden.")
            } else {
                // flexible columns — fixed-width children here once forced the whole
                // page to overflow its side margins (the VStack min-width trap)
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(topSkills)) { sk in
                        let lv = store.levelOf(sk.id)
                        VStack(spacing: 4) {
                            CroppedPlantView(spec: PlantSpec(id: sk.id, colorHex: sk.color, species: sk.species), level: lv.level, width: 74)
                            HStack(spacing: 4) {
                                Ic(name: sk.icon, size: 11)
                                Text(sk.name).font(.quicksandBold(12))
                            }
                            .foregroundColor(theme.inkStrong)
                            .lineLimit(1)
                            Text("Lv \(lv.level) · \(fmtMin(store.weekMinutes(sk.id))) this wk")
                                .font(.quicksand(10.5)).foregroundColor(theme.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .frame(maxWidth: .infinity)
                        .onTapGesture { switchTab(.garden) }
                    }
                }
            }
        }
        .card()
    }

    // MARK: up next (events, 7 days out)

    private func upNextCard(today: String) -> some View {
        var items: [(date: String, ev: BloomEvent)] = []
        for i in 1...7 {
            let d = addDays(today, i)
            for e in store.state.events where e.occurs(on: d) {
                items.append((d, e))
            }
        }
        items.sort { ($0.date, $0.ev.time ?? "") < ($1.date, $1.ev.time ?? "") }
        let top = items.prefix(5)

        return VStack(alignment: .leading, spacing: 13) {
            BloomTitle(prefix: "Up ", em: "next", icon: "arrow")
            if top.isEmpty {
                Text("A clear week ahead.").font(.quicksand(13)).foregroundColor(theme.muted)
            }
            ForEach(Array(top.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 2).fill(Color(hex: item.ev.color)).frame(width: 4, height: 22)
                    Text(relDue(item.date)).font(.quicksandBold(12)).foregroundColor(theme.muted)
                        .frame(width: 74, alignment: .leading)
                    Text(item.ev.title).font(.quicksand(13.5)).foregroundColor(theme.ink).lineLimit(1)
                    Spacer()
                    if let time = item.ev.time {
                        Chip(text: fmtTime(time, h24: store.state.settings.hour24))
                    }
                }
            }
        }
        .card()
    }
}

// MARK: - Bits shared with other views

struct EventRow: View {
    @Environment(\.theme) private var theme
    var event: BloomEvent
    var timeText: String

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Color(hex: event.color)).frame(width: 4, height: 24)
            Text(timeText).font(.quicksandBold(12)).foregroundColor(theme.muted)
            Text(event.title).font(.quicksand(13.5)).foregroundColor(theme.ink).lineLimit(1)
            Spacer()
        }
    }
}

struct BloomFieldStyle: TextFieldStyle {
    @Environment(\.theme) private var theme

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.quicksand(14))
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Capsule().fill(theme.card2.opacity(0.6)))
            .overlay(Capsule().stroke(theme.line, lineWidth: 1.5))
            .foregroundColor(theme.ink)
    }
}

struct CheckButton: View {
    @Environment(\.theme) private var theme
    var checked: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .stroke(checked ? theme.olive : theme.lineStrong, lineWidth: 2)
                    .background(Circle().fill(checked ? theme.olive : .clear))
                    .frame(width: 22, height: 22)
                if checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(hex: "#FFFDF4"))
                }
            }
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: checked)
    }
}

/// The magic box: "1h math" → preview → logged. Port of quicklog.js.
struct QuickLogBox: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    @State private var text = ""
    @State private var pickedSkillId: String? = nil

    private static let HINT = "Practiced something without the timer? Type it here — it still counts."

    private var parsed: QuickLogResult? {
        parseQuickLog(text, skills: store.state.skills, forced: store.skill(pickedSkillId))
    }

    private var preview: (String, Bool) {
        let picked = store.skill(pickedSkillId)
        if text.trimmingCharacters(in: .whitespaces).isEmpty {
            return (picked.map { "Type how long you practiced \($0.name) — like “45m” or “1h”" } ?? Self.HINT, false)
        }
        guard let p = parsed else {
            return (picked != nil ? "Add a duration like “45m” or “1h”" : "Add a duration like “45m” or “1h” and what it was for", false)
        }
        let target = p.skill?.name ?? "a new plant “\(p.name)”"
        let when = p.date != todayYmd() ? " · \(fmtDate(p.date))" : ""
        return ("↵ Add \(fmtMin(p.minutes)) to \(target)\(when)", true)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField(store.skill(pickedSkillId) != nil ? "How long? — “45m”, “1h yesterday”" : "“1h math”, “30m spanish yesterday”", text: $text)
                    .textFieldStyle(BloomFieldStyle())
                    .autocorrectionDisabled()
                    .onSubmit(commit)
                Button(action: commit) {
                    Text("Add")
                }
                .buttonStyle(PillButtonStyle(kind: .primary))
            }
            if !store.state.skills.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        Text("for").font(.quicksand(11.5)).foregroundColor(theme.muted)
                        ForEach(store.state.skills) { sk in
                            Button {
                                pickedSkillId = pickedSkillId == sk.id ? nil : sk.id
                                Sfx.shared.click()
                            } label: {
                                Chip(text: sk.name, icon: sk.icon, selected: pickedSkillId == sk.id)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            let (msg, ok) = preview
            Text(msg)
                .font(.quicksand(12))
                .foregroundColor(ok ? theme.olive2 : theme.muted)
        }
    }

    private func commit() {
        guard let p = parsed else { Sfx.shared.uhoh(); return }
        store.commitQuickLog(p)
        text = ""
    }
}
