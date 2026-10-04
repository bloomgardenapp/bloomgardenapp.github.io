// CalendarView.swift — calendar.js ported: Monday-first month grid where events,
// task due-dates and focus sessions all meet; a day panel with list + planner
// timeline; the event editor with repeats, colors, and Google-style scoping.
import SwiftUI

struct CalendarView: View {
    @Environment(\.theme) private var theme
    @Environment(\.horizontalSizeClass) private var hSize
    @Bindable var store: AppStore

    @State private var viewYear: Int
    @State private var viewMonth: Int    // 0-based like JS
    @State private var selected = todayYmd()
    @State private var editingId: String? = nil
    @State private var dayMode = "list"          // list | plan
    @State private var quickTaskText = ""
    @State private var pageScrollLocked = false
    @State private var dayTapTick = 0

    init(store: AppStore) {
        self.store = store
        let now = Date()
        _viewYear = State(initialValue: Calendar.current.component(.year, from: now))
        _viewMonth = State(initialValue: Calendar.current.component(.month, from: now) - 1)
        #if DEBUG
        if let m = UserDefaults.standard.string(forKey: "bloomDayMode") { _dayMode = State(initialValue: m) }
        #endif
    }

    var body: some View {
        GeometryReader { geo in
        // the web stacks below 900px — same breakpoint here (logical points ≈ CSS px)
        let sideBySide = hSize == .regular && geo.size.width > 900
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ViewHeader(prefix: "Your ", em: "month", icon: "calendar",
                               sub: "Your events, tasks and focus — the whole month at a glance.") { EmptyView() }
                    if sideBySide {
                        // the web's cal-wrap: month grid beside the day panel (1.7fr : 1fr)
                        HStack(alignment: .top, spacing: 16) {
                            monthGrid.card(padding: 14)
                            DayPanel(store: store, selected: $selected, editingId: $editingId,
                                     dayMode: $dayMode, quickTaskText: $quickTaskText,
                                     pageScrollLocked: $pageScrollLocked)
                                .frame(width: 390)
                                .id("dayPanel")
                        }
                    } else {
                        monthGrid.card(padding: 12)
                        DayPanel(store: store, selected: $selected, editingId: $editingId,
                                 dayMode: $dayMode, quickTaskText: $quickTaskText,
                                 pageScrollLocked: $pageScrollLocked)
                            .id("dayPanel")
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 14)
                .padding(.bottom, 28)
                .pageColumn(1080)
            }
            .scrollDisabled(pageScrollLocked)   // a held planner block owns the touch
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: dayTapTick) {
                // picking a date jumps down to that day's panel — tapping did "nothing" before
                // (side-by-side layouts already show the panel, no scroll needed)
                if !sideBySide {
                    withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo("dayPanel", anchor: .top) }
                }
            }
        }
        }
    }

    // MARK: - Month grid

    private func tasksDue(_ date: String) -> [TaskItem] {
        store.state.tasks.filter { $0.due == date }
    }

    private var monthGrid: some View {
        let firstOfMonth = Calendar.current.date(from: DateComponents(year: viewYear, month: viewMonth + 1, day: 1, hour: 12))!
        let startIdx = (weekday(of: ymd(firstOfMonth)) + 6) % 7   // Monday-first
        let today = todayYmd()

        return VStack(spacing: 8) {
            HStack(spacing: 8) {
                Button {
                    Sfx.shared.click()
                    viewMonth -= 1
                    if viewMonth < 0 { viewMonth = 11; viewYear -= 1 }
                } label: {
                    Image(systemName: "chevron.left").font(.system(size: 14, weight: .semibold))
                        .foregroundColor(theme.muted).padding(6)
                }
                .buttonStyle(.plain)
                Text("\(MONTH_NAMES[viewMonth]) \(String(viewYear))")
                    .font(.display(17)).foregroundColor(theme.inkStrong)
                Button {
                    Sfx.shared.click()
                    viewMonth += 1
                    if viewMonth > 11 { viewMonth = 0; viewYear += 1 }
                } label: {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold))
                        .foregroundColor(theme.muted).padding(6)
                }
                .buttonStyle(.plain)
                Spacer()
                Button("Today") {
                    Sfx.shared.click()
                    let now = Date()
                    viewYear = Calendar.current.component(.year, from: now)
                    viewMonth = Calendar.current.component(.month, from: now) - 1
                    selected = todayYmd()
                }
                .buttonStyle(PillButtonStyle())
            }

            HStack(spacing: 6) {
                ForEach(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], id: \.self) { d in
                    Text(d).font(.quicksandBold(10)).kerning(1.2).foregroundColor(theme.muted)
                        .frame(maxWidth: .infinity)
                }
            }

            let cols = [GridItem](repeating: GridItem(.flexible(), spacing: 6), count: 7)
            LazyVGrid(columns: cols, spacing: 6) {
                ForEach(0..<42, id: \.self) { i in
                    let d = Calendar.current.date(byAdding: .day, value: i - startIdx, to: firstOfMonth)!
                    dayCell(d, today: today)
                }
            }
        }
    }

    private func dayCell(_ d: Date, today: String) -> some View {
        let dY = ymd(d)
        let other = Calendar.current.component(.month, from: d) - 1 != viewMonth
        let evs = store.eventsOn(dY)
        let openDue = tasksDue(dY).filter { !$0.done }
        let focusMin = store.minutesOn(dY)
        let isToday = dY == today
        let isSel = dY == selected

        return Button {
            Sfx.shared.click()
            selected = dY
            editingId = nil
            dayTapTick += 1
            if other {
                viewYear = Calendar.current.component(.year, from: d)
                viewMonth = Calendar.current.component(.month, from: d) - 1
            }
        } label: {
            let wide = hSize == .regular
            VStack(alignment: .leading, spacing: wide ? 4 : 2) {
                HStack(spacing: 2) {
                    // web .cal-num: display serif, muted — olive when today
                    Text("\(Calendar.current.component(.day, from: d))")
                        .font(.display(wide ? 12.5 : 11.5))
                        .foregroundColor(isToday ? theme.olive2 : theme.muted)
                    Spacer(minLength: 0)
                    HStack(spacing: wide ? 4 : 3) {
                        if !openDue.isEmpty {   // web task dot: hollow ring
                            Circle().stroke(theme.muted, lineWidth: 1.7)
                                .frame(width: wide ? 7 : 4.5, height: wide ? 7 : 4.5)
                        }
                        if focusMin > 0 {       // web focus dot: filled green
                            Circle().fill(theme.green)
                                .frame(width: wide ? 7 : 4.5, height: wide ? 7 : 4.5)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: wide ? 3 : 1) {
                    ForEach(evs.prefix(2)) { ev in
                        HStack(spacing: wide ? 5 : 2) {
                            if ev.important == true {
                                Text("★").font(.system(size: wide ? 9 : 6)).foregroundColor(Color(hex: "#E0B54F"))
                            } else {
                                Circle().fill(Color(hex: ev.color))
                                    .frame(width: wide ? 6 : 3.5, height: wide ? 6 : 3.5)
                            }
                            Text(ev.title)
                                .font(.quicksandBold(wide ? 10.5 : 7.5)).lineLimit(1)
                                .foregroundColor(ev.important == true ? theme.inkStrong : theme.ink)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if evs.count > 2 {
                        Text("+\(evs.count - 2)").font(.quicksandBold(wide ? 9.5 : 7)).foregroundColor(theme.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(wide ? 7 : 4)
            // phone cells sit ~42pt wide, so a 52pt floor made them visibly taller than
            // they are wide — 44 lands them square, matching the web's day boxes. It's a
            // floor, not a fixed height: a busy day still grows rather than clipping.
            .frame(minHeight: wide ? 84 : 44, alignment: .top)
            // web .cal-cell: card-2 blocks on the card, whole cell fades when out of month,
            // today gets the olive-soft wash, selected gets the olive border
            .background(RoundedRectangle(cornerRadius: wide ? 14 : 9, style: .continuous)
                .fill(isToday ? theme.oliveSoft : theme.card2))
            .overlay(RoundedRectangle(cornerRadius: wide ? 14 : 9, style: .continuous)
                .stroke(isSel ? theme.olive : .clear, lineWidth: 1.5))
            .opacity(other ? 0.4 : 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Day panel

struct DayPanel: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    @Binding var selected: String
    @Binding var editingId: String?
    @Binding var dayMode: String
    @Binding var quickTaskText: String
    @Binding var pageScrollLocked: Bool

    var body: some View {
        let evs = store.eventsOn(selected)
        let due = store.state.tasks.filter { $0.due == selected }
            .sorted { a, b in a.done != b.done ? !a.done : a.priority > b.priority }
        let sessions = store.state.sessions.filter { $0.date == selected }
        let diff = dayDiff(todayYmd(), selected)
        let label = diff == 0 ? "Today · " : diff == 1 ? "Tomorrow · " : diff == -1 ? "Yesterday · " : ""

        VStack(alignment: .leading, spacing: 13) {
            Text(label + fmtDate(selected))
                .font(.display(17)).foregroundColor(theme.inkStrong)

            HStack {
                sectionLabel("Events")
                Spacer()
                ForEach([("list", "list"), ("plan", "day planner")], id: \.0) { key, lbl in
                    Button {
                        if dayMode != key { Sfx.shared.click(); dayMode = key }
                    } label: {
                        Chip(text: lbl, selected: dayMode == key)
                    }
                    .buttonStyle(.plain)
                }
            }

            if dayMode == "plan" {
                DayTimeline(store: store, selected: $selected, editingId: $editingId, events: evs, pageScrollLocked: $pageScrollLocked)
            } else if evs.isEmpty {
                Text("Nothing scheduled.").font(.quicksand(12.5)).foregroundColor(theme.muted)
            } else {
                ForEach(evs) { ev in
                    EventListRow(store: store, event: ev, selected: selected, editingId: $editingId)
                }
            }

            EventForm(store: store, selected: $selected, editingId: $editingId)

            sectionLabel("Tasks due")
            if due.isEmpty {
                Text("No tasks due.").font(.quicksand(12.5)).foregroundColor(theme.muted)
            }
            ForEach(due) { t in
                TaskRow(store: store, task: t, showDue: false)
            }
            TextField("＋ Add a task due this day…", text: $quickTaskText)
                .textFieldStyle(BloomFieldStyle())
                .onSubmit {
                    let v = quickTaskText.trimmingCharacters(in: .whitespaces)
                    guard !v.isEmpty else { return }
                    store.addTask(title: v, due: selected, skillId: nil, priority: 0, repeatRule: nil)
                    quickTaskText = ""
                }

            sectionLabel("Focus that day")
            if sessions.isEmpty {
                Text(diff > 0 ? "The future is unwritten." : "No focus logged.")
                    .font(.quicksand(12.5)).foregroundColor(theme.muted)
            } else {
                let bySkill = Dictionary(grouping: sessions, by: { $0.skillId })
                    .map { (skillId: $0.key, minutes: $0.value.reduce(0) { $0 + $1.minutes }) }
                    .sorted { $0.minutes > $1.minutes }
                ForEach(bySkill, id: \.skillId) { row in
                    let sk = store.skill(row.skillId)
                    HStack(spacing: 6) {
                        Ic(name: sk?.icon ?? "hourglass", size: 12).foregroundColor(theme.olive)
                        Text(sk?.name ?? (row.skillId != nil ? "unknown" : "just focus"))
                            .font(.quicksand(13)).foregroundColor(theme.ink)
                        Spacer()
                        Chip(text: fmtMin(row.minutes), style: .green)
                    }
                }
                HStack {
                    Spacer()
                    Chip(text: "total \(fmtMin(store.minutesOn(selected)))", style: .lilac)
                }
            }
        }
        .card()
    }

    private func sectionLabel(_ s: String) -> some View {
        Text(s.uppercased()).font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted)
    }
}

// MARK: - Event list row

struct EventListRow: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    var event: BloomEvent
    var selected: String
    @Binding var editingId: String?
    @State private var confirmDelete = false

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Color(hex: event.color)).frame(width: 4, height: 24)
            Text(event.time != nil
                 ? fmtTime(event.time, h24: store.state.settings.hour24) + (event.timeEnd != nil ? " – \(fmtTime(event.timeEnd, h24: store.state.settings.hour24))" : "")
                 : "all day")
                .font(.quicksandBold(12)).foregroundColor(theme.muted)
            if event.important == true {
                Text("★").font(.system(size: 11)).foregroundColor(Color(hex: "#E0B54F"))
            }
            Text(event.title).font(.quicksand(13.5)).foregroundColor(theme.ink)
                .lineLimit(1)
                .layoutPriority(-1)   // the title gives way; chips and times stay whole
            if event.repeatRule != nil {
                Chip(text: repeatLabel(repeatRule: event.repeatRule, days: event.days), icon: "repeat", style: .lilac)
                    .fixedSize()
            }
            Spacer(minLength: 4)
            Button { editingId = event.id } label: {
                Ic(name: "pencil", size: 13).foregroundColor(theme.muted)
            }
            .buttonStyle(.plain)
            Button { confirmDelete = true } label: {
                Ic(name: "trash", size: 13).foregroundColor(theme.muted)
            }
            .buttonStyle(.plain)
        }
        .confirmationDialog(
            event.repeatRule != nil
                ? "“\(event.title)” repeats \(repeatLabel(repeatRule: event.repeatRule, days: event.days)) — delete what?"
                : "Delete “\(event.title)”?",
            isPresented: $confirmDelete, titleVisibility: .visible
        ) {
            if event.repeatRule != nil {
                Button("Just this day") { store.deleteEvent(event.id, scope: .one, on: selected) }
                Button("This and all following days") { store.deleteEvent(event.id, scope: .following, on: selected) }
                Button("All days", role: .destructive) { store.deleteEvent(event.id, scope: .all, on: selected) }
            } else {
                Button("Delete", role: .destructive) { store.deleteEvent(event.id, scope: .all, on: selected) }
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

// MARK: - Planner timeline

struct DayTimeline: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    @Binding var selected: String
    @Binding var editingId: String?
    var events: [BloomEvent]

    private static let hourPx: CGFloat = 48
    private struct Timed: Identifiable {
        var id: String { ev.id }
        var ev: BloomEvent
        var start: Int
        var end: Int
        var col = 0
        var ncols = 1
    }

    // Drag-in-scroll the way that actually holds up: one always-listening
    // simultaneous drag per block. A dwell timer arms it (scroll frozen from that
    // moment); before arming, quick movements stay ordinary scrolls. The touching
    // GestureState is the cancellation safety net — it resets even when the
    // system kills the touch, and disarming rides on that.
    @GestureState private var touching = false
    @State private var armedId: String? = nil
    @State private var dragOffsetY: CGFloat = 0
    @State private var lastTranslationY: CGFloat = 0
    @State private var armBaseY: CGFloat = 0
    @State private var armWork: DispatchWorkItem? = nil
    @State private var suppressTap = false
    // manual timeline scrolling — no ScrollView, so nothing competes with the drag
    @State private var timelineOffset: CGFloat = 0
    @State private var panStartOffset: CGFloat? = nil
    @State private var windowFrame: CGRect = .zero
    @State private var glideSpeed: CGFloat = 0
    @State private var glideTimer: Timer? = nil
    @State private var armOffset0: CGFloat = 0
    private static let windowH: CGFloat = 430
    private var maxOffset: CGFloat { 24 * Self.hourPx - Self.windowH }
    @Binding var pageScrollLocked: Bool
    @State private var pendingMove: (id: String, minutes: Int)? = nil
    @State private var showMoveScope = false

    private var timed: [Timed] {
        var list: [Timed] = events.compactMap { ev in
            guard let t = ev.time else { return nil }
            let p = t.split(separator: ":").compactMap { Int($0) }
            guard p.count == 2 else { return nil }
            let start = p[0] * 60 + p[1]
            var end = start + 60   // no end time → assume an hour
            if let te = ev.timeEnd {
                let q = te.split(separator: ":").compactMap { Int($0) }
                if q.count == 2 { end = q[0] * 60 + q[1] }
            }
            if end <= start { end = start + 30 }
            return Timed(ev: ev, start: start, end: end)
        }.sorted { a, b in a.start != b.start ? a.start < b.start : a.end > b.end }

        // overlapping events share the width, google-style: greedy columns per cluster
        var colEnds: [Int] = []
        for i in list.indices {
            var c = 0
            while c < colEnds.count && colEnds[c] > list[i].start { c += 1 }
            list[i].col = c
            if c == colEnds.count { colEnds.append(list[i].end) } else { colEnds[c] = list[i].end }
        }
        var clusterStart = 0
        var clusterEnd = -1
        for i in list.indices {
            if i > 0 && list[i].start >= clusterEnd {
                let n = (list[clusterStart..<i].map(\.col).max() ?? 0) + 1
                for j in clusterStart..<i { list[j].ncols = n }
                clusterStart = i
            }
            clusterEnd = max(clusterEnd, list[i].end)
        }
        let n = (list[clusterStart...].map(\.col).max() ?? 0) + 1
        for j in clusterStart..<list.count { list[j].ncols = n }
        return list
    }

    var body: some View {
        let allday = events.filter { $0.time == nil }
        let h24 = store.state.settings.hour24
        let blocks = timed

        VStack(alignment: .leading, spacing: 8) {
            if !allday.isEmpty {
                FlowChips(spacing: 6) {
                    ForEach(allday) { ev in
                        Button { editingId = ev.id } label: {
                            Chip(text: (ev.important == true ? "★ " : "") + ev.title + " · all day")
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            ZStack(alignment: .topLeading) {
                // hour lines + labels
                VStack(spacing: 0) {
                    ForEach(0..<24, id: \.self) { h in
                        HStack(alignment: .top, spacing: 6) {
                            Text(fmtTime("\(pad2(h)):00", h24: h24).replacingOccurrences(of: ":00", with: ""))
                                .font(.quicksandBold(9)).foregroundColor(theme.muted)
                                .frame(width: 40, alignment: .trailing)
                            VStack { Divider().background(theme.line) }
                                .padding(.top, 6)
                        }
                        .frame(height: Self.hourPx, alignment: .top)
                    }
                }
                // event blocks
                GeometryReader { geo in
                    let laneX: CGFloat = 50
                    let laneW = geo.size.width - laneX - 4
                    ForEach(blocks) { t in
                        let dur = t.end - t.start
                        let isDragging = armedId == t.ev.id
                        eventBlock(t, h24: h24)
                            .frame(width: laneW / CGFloat(t.ncols) - 3,
                                   height: max(22, CGFloat(dur) / 60 * Self.hourPx - 2))
                            .scaleEffect(isDragging ? 1.03 : 1)
                            .shadow(color: .black.opacity(isDragging ? 0.25 : 0), radius: 8, y: 3)
                            .offset(x: laneX + laneW * CGFloat(t.col) / CGFloat(t.ncols),
                                    y: CGFloat(t.start) / 60 * Self.hourPx + 1 + (isDragging ? dragOffsetY : 0))
                            .zIndex(isDragging ? 2 : 1)
                    }
                }
            }
            .frame(height: 24 * Self.hourPx, alignment: .top)
            .offset(y: -timelineOffset)
            .frame(height: Self.windowH, alignment: .top)
            .clipped()
            .contentShape(Rectangle())
            .background(GeometryReader { g in
                Color.clear
                    .onAppear { windowFrame = g.frame(in: .global) }
                    .onChange(of: g.frame(in: .global)) { _, f in windowFrame = f }
            })
            .highPriorityGesture(
                // the timeline's own pan — beats the page scroll, ignores armed drags
                DragGesture(minimumDistance: 6, coordinateSpace: .global)
                    .onChanged { v in
                        guard armedId == nil else { return }
                        if panStartOffset == nil { panStartOffset = timelineOffset }
                        timelineOffset = min(max(panStartOffset! - v.translation.height, 0), maxOffset)
                    }
                    .onEnded { _ in panStartOffset = nil }
            )
            .onAppear {
                let first = blocks.first.map { CGFloat($0.start) / 60 * Self.hourPx - 24 } ?? (8 * Self.hourPx)
                timelineOffset = min(max(first, 0), maxOffset)
            }
            Text("Hold a block, then drag to move it.")
                .font(.quicksand(10.5)).foregroundColor(theme.muted)
        }
        .onChange(of: armedId) { _, id in
            pageScrollLocked = id != nil     // freeze the page scroll under the drag
            if id != nil { Haptics.tap() }   // the moment the block arms
        }
        .onChange(of: touching) { _, isDown in
            if !isDown { disarm() }          // fires even on system-cancelled touches
        }
        .confirmationDialog(moveTitle, isPresented: $showMoveScope, titleVisibility: .visible) {
            Button("Just this day") { commitMove(scope: .one) }
            Button("All days") { commitMove(scope: .all) }
            Button("Cancel", role: .cancel) { pendingMove = nil }
        }
    }

    private var moveTitle: String {
        guard let p = pendingMove, let ev = store.state.events.first(where: { $0.id == p.id }) else { return "" }
        return "“\(ev.title)” repeats \(repeatLabel(repeatRule: ev.repeatRule, days: ev.days)) — move what?"
    }

    private func commitMove(scope: AppStore.RepeatScope) {
        guard let p = pendingMove else { return }
        store.moveEvent(p.id, toMinutes: p.minutes, scope: scope, on: selected)
        pendingMove = nil
    }

    private func eventBlock(_ t: Timed, h24: Bool) -> some View {
        let c = Color(hex: t.ev.color)
        return VStack(alignment: .leading, spacing: 1) {
            Text((t.ev.important == true ? "★ " : "") + t.ev.title)
                .font(.quicksandBold(10.5)).lineLimit(1)
            let shownStart = armedId == t.ev.id ? draggedMinutes(t) : t.start
            let label = fmtTime("\(pad2(shownStart / 60)):\(pad2(shownStart % 60))", h24: h24)
                + (t.ev.timeEnd != nil ? " – \(fmtTime("\(pad2((shownStart + t.end - t.start) / 60 % 24)):\(pad2((shownStart + t.end - t.start) % 60))", h24: h24))" : "")
            Text(label).font(.quicksand(9)).opacity(0.85)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(c.opacity(theme.isDark ? 0.42 : 0.28)))
        .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(c, lineWidth: 1.2))
        .foregroundColor(theme.inkStrong)
        .onTapGesture {
            guard !suppressTap else { suppressTap = false; return }
            editingId = t.ev.id
            Sfx.shared.click()
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .global)
                .updating($touching) { _, state, _ in state = true }
                .onChanged { v in
                    lastTranslationY = v.translation.height
                    if armedId == t.ev.id {
                        // content-space offset: finger movement + whatever glided beneath it
                        dragOffsetY = (v.translation.height - armBaseY) + (timelineOffset - armOffset0)
                        // near the window's edge the hours glide to reach off-screen times
                        let zone: CGFloat = 52
                        let bottomEdge = min(windowFrame.maxY, UIScreen.main.bounds.height - 90)
                        if v.location.y < windowFrame.minY + zone {
                            glideSpeed = -min(8, (windowFrame.minY + zone - v.location.y) / 6)
                        } else if v.location.y > bottomEdge - zone {
                            glideSpeed = min(8, (v.location.y - (bottomEdge - zone)) / 6)
                        } else {
                            glideSpeed = 0
                        }
                        return
                    }
                    guard armedId == nil else { return }
                    let moved = abs(v.translation.height) > 12 || abs(v.translation.width) > 12
                    if armWork == nil && !moved {
                        // finger just landed — arm after a still dwell
                        let work = DispatchWorkItem {
                            armWork = nil
                            armedId = t.ev.id
                            armBaseY = lastTranslationY
                            armOffset0 = timelineOffset
                            dragOffsetY = 0
                            suppressTap = true
                            startGlideTimer()
                        }
                        armWork = work
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
                    } else if moved, let work = armWork {
                        work.cancel()   // it's a scroll — never arm mid-flight
                        armWork = nil
                    }
                }
                .onEnded { v in
                    _ = v
                    armWork?.cancel()
                    armWork = nil
                    guard armedId == t.ev.id else { disarm(); return }
                    let delta = Int((dragOffsetY / Self.hourPx * 60).rounded())
                    var cand = ((t.start + delta) / 15) * 15
                    cand = max(0, min(cand, 24 * 60 - (t.end - t.start)))
                    disarm()
                    guard cand != t.start else { return }
                    if t.ev.repeatRule != nil {
                        pendingMove = (t.ev.id, cand)
                        showMoveScope = true
                    } else {
                        store.moveEvent(t.ev.id, toMinutes: cand, scope: .all, on: selected)
                    }
                }
        )
    }

    private func startGlideTimer() {
        glideTimer?.invalidate()
        glideTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { _ in
            guard armedId != nil, glideSpeed != 0 else { return }
            timelineOffset = min(max(timelineOffset + glideSpeed, 0), maxOffset)
            // keep the block glued to the resting finger while the hours slide past
            dragOffsetY = (lastTranslationY - armBaseY) + (timelineOffset - armOffset0)
        }
    }

    private func disarm() {
        glideTimer?.invalidate()
        glideTimer = nil
        glideSpeed = 0
        armWork?.cancel()
        armWork = nil
        armedId = nil
        dragOffsetY = 0
        armBaseY = 0
        armOffset0 = 0
    }

    private func draggedMinutes(_ t: Timed) -> Int {
        let delta = Int((dragOffsetY / Self.hourPx * 60).rounded())
        var cand = ((t.start + delta) / 15) * 15
        cand = max(0, min(cand, 24 * 60 - (t.end - t.start)))
        return cand
    }
}

// MARK: - Event form (add / edit)

struct EventForm: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    @Binding var selected: String
    @Binding var editingId: String?

    @State private var title = ""
    @State private var timeText = ""
    @State private var endText = ""
    @State private var ampm = "pm"
    @State private var color = "#D89B8A"
    @State private var important = false
    @State private var repeatRule: String? = nil
    @State private var days: Set<Int> = []
    @State private var loadedFor: String? = "unloaded"
    @State private var showEditScope = false
    @State private var pendingChanges: BloomEvent? = nil

    private var editing: BloomEvent? {
        editingId.flatMap { id in store.state.events.first { $0.id == id } }
    }

    var body: some View {
        let h24 = store.state.settings.hour24

        VStack(alignment: .leading, spacing: 8) {
            TextField(editing != nil ? "Event title" : "＋ Add an event…", text: $title)
                .textFieldStyle(BloomFieldStyle())

            HStack(spacing: 6) {
                TextField(h24 ? "19:30" : "7:30", text: $timeText)
                    .textFieldStyle(BloomFieldStyle())
                    .frame(width: h24 ? 84 : 72)
                    .keyboardType(.numbersAndPunctuation)
                if !h24 {
                    ForEach(["am", "pm"], id: \.self) { v in
                        Button {
                            ampm = v
                            Sfx.shared.click()
                        } label: {
                            Chip(text: v.uppercased(), selected: ampm == v)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("to").font(.quicksand(11.5)).foregroundColor(theme.muted)
                TextField(h24 ? "21:00" : "8:30", text: $endText)
                    .textFieldStyle(BloomFieldStyle())
                    .frame(width: h24 ? 84 : 80)
                    .keyboardType(.numbersAndPunctuation)
                Spacer()
            }

            HStack(spacing: 6) {
                Menu {
                    Button("once") { repeatRule = nil }
                    Button("daily") { repeatRule = "daily" }
                    Button("weekly") { repeatRule = "weekly" }
                    Button("monthly") { repeatRule = "monthly" }
                    Button("certain days…") { repeatRule = "days" }
                } label: {
                    Chip(text: repeatRule ?? "once", icon: "repeat", selected: repeatRule != nil)
                }
                Button {
                    important.toggle()
                    Sfx.shared.click()
                } label: {
                    Chip(text: "\(important ? "★" : "☆") important", style: .sun, selected: important)
                }
                .buttonStyle(.plain)
            }

            if repeatRule == "days" {
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { i in
                        Button {
                            if days.contains(i) { days.remove(i) } else { days.insert(i) }
                            Sfx.shared.click()
                        } label: {
                            Text(["S", "M", "T", "W", "T", "F", "S"][i])
                                .font(.quicksandBold(11))
                                .frame(width: 28, height: 28)
                                .background(Circle().fill(days.contains(i) ? theme.olive : theme.card2))
                                .foregroundColor(days.contains(i) ? Color(hex: "#FFFDF4") : theme.ink)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            HStack(spacing: 8) {
                ForEach(PALETTE.prefix(7), id: \.self) { c in
                    Button {
                        color = c
                        Sfx.shared.click()
                    } label: {
                        Circle().fill(Color(hex: c)).frame(width: 22, height: 22)
                            .overlay(Circle().stroke(theme.inkStrong.opacity(color == c ? 0.7 : 0), lineWidth: 2).padding(-3))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 8) {
                Button(editing != nil ? "Save event" : "＋ Add event") { submit() }
                    .buttonStyle(PillButtonStyle(kind: .primary))
                    .opacity(title.trimmingCharacters(in: .whitespaces).isEmpty ? 0.55 : 1)
                if editing != nil {
                    Button("cancel") { editingId = nil }
                        .buttonStyle(.plain)
                        .font(.quicksandBold(12)).foregroundColor(theme.olive2)
                }
            }
        }
        .onChange(of: editingId) { loadDraft() }
        .onChange(of: selected) { if editing == nil { loadedFor = nil } }
        .onAppear(perform: loadDraft)
        .confirmationDialog(
            "“\(editing?.title ?? "")” repeats \(repeatLabel(repeatRule: editing?.repeatRule, days: editing?.days)) — change what?",
            isPresented: $showEditScope, titleVisibility: .visible
        ) {
            Button("Just this day") { commitEdit(scope: .one) }
            Button("All days") { commitEdit(scope: .all) }
            Button("Cancel", role: .cancel) { pendingChanges = nil }
        }
    }

    private func loadDraft() {
        guard loadedFor != editingId else { return }
        loadedFor = editingId
        let h24 = store.state.settings.hour24
        if let ev = editing {
            title = ev.title
            if let t = ev.time {
                let hh = Int(t.prefix(2)) ?? 0
                ampm = hh >= 12 ? "pm" : "am"
                timeText = h24 ? t : fmtTime(t, h24: false).replacingOccurrences(of: " am", with: "").replacingOccurrences(of: " pm", with: "")
            } else { timeText = "" }
            endText = ev.timeEnd.map { h24 ? $0 : fmtTime($0, h24: false) } ?? ""
            color = ev.color
            important = ev.important == true
            repeatRule = ev.repeatRule
            days = Set(ev.days ?? [])
        } else {
            title = ""; timeText = ""; endText = ""; important = false
            repeatRule = nil; days = []; color = "#D89B8A"
        }
    }

    /// Field text (+ AM/PM chip in 12h mode) → HH:MM, blank, or invalid.
    private func timeValue() -> TimeParse {
        var t = timeText.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return .blank }
        let h24 = store.state.settings.hour24
        if !h24, t.range(of: "[ap]", options: [.regularExpression, .caseInsensitive]) == nil,
           let hh = Int(t.prefix(while: { $0.isNumber })), (1...12).contains(hh) {
            t += ampm
        }
        return parseTimeInput(t)
    }

    /// End time: typed am/pm wins; otherwise pick the half of the day after the start.
    private func endValue(start: String?) -> TimeParse {
        let t = endText.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return .blank }
        let h24 = store.state.settings.hour24
        if !h24, t.range(of: "[ap]", options: [.regularExpression, .caseInsensitive]) == nil,
           let hh = Int(t.prefix(while: { $0.isNumber })), (1...12).contains(hh) {
            if let start {
                if case .time(let a) = parseTimeInput(t + "am"), a > start { return .time(a) }
                return parseTimeInput(t + "pm")
            }
            return parseTimeInput(t + ampm)
        }
        return parseTimeInput(t)
    }

    private func submit() {
        let name = title.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { Sfx.shared.uhoh(); return }
        let h24 = store.state.settings.hour24

        var time: String? = nil
        switch timeValue() {
        case .invalid:
            Sfx.shared.uhoh()
            store.toast(h24 ? "Try a time like 19:30 — or leave it blank" : "Try a time like 7:30 — or leave it blank", "clock")
            return
        case .time(let t): time = t
        case .blank: break
        }
        var timeEnd: String? = nil
        switch endValue(start: time) {
        case .invalid:
            Sfx.shared.uhoh()
            store.toast(h24 ? "Try an end time like 21:00 — or leave it blank" : "Try an end time like 8:30 — or leave it blank", "clock")
            return
        case .time(let t): timeEnd = t
        case .blank: break
        }
        if timeEnd != nil && time == nil {
            Sfx.shared.uhoh()
            store.toast("Add a start time to go with the end time", "clock")
            return
        }
        if let te = timeEnd, let t = time, te <= t {
            Sfx.shared.uhoh()
            store.toast("The end time needs to come after the start", "clock")
            return
        }
        if repeatRule == "days" && days.isEmpty {
            Sfx.shared.uhoh()
            store.toast("Pick at least one day to repeat on", "clock")
            return
        }

        var vals = BloomEvent(title: name, date: selected, time: time, timeEnd: timeEnd,
                              color: color, important: important, repeatRule: repeatRule,
                              days: repeatRule == "days" ? Array(days).sorted() : nil)
        if let ev = editing {
            vals.id = ev.id
            if ev.repeatRule != nil && vals.repeatRule != nil {
                pendingChanges = vals
                showEditScope = true
                return
            }
            store.applyEventEdit(ev.id, changes: vals, scope: .all, on: selected)
            editingId = nil
        } else {
            store.addEvent(vals)
            title = ""; timeText = ""; endText = ""; important = false
            repeatRule = nil; days = []
        }
    }

    private func commitEdit(scope: AppStore.RepeatScope) {
        guard let changes = pendingChanges, let ev = editing else { return }
        store.applyEventEdit(ev.id, changes: changes, scope: scope, on: selected)
        pendingChanges = nil
        editingId = nil
    }
}
