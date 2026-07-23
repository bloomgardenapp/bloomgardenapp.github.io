// FocusView.swift — the focus timer: Pomofocus-style tabs, skill chips, ring card,
// zen fullscreen with a live-growing plant, manual logging, session history.
import SwiftUI

private let FREE = "free"   // sentinel: focus without a plant

struct FocusView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore

    @State private var selSkillId: String? = nil
    @State private var selTab = "focus"       // focus | short | long
    @State private var selDur = 25
    @State private var selShort = 5
    @State private var selLong = 15
    @State private var customDur = ""
    @State private var customBreak = ""
    @State private var showSkillEditor = false
    @State private var confirmEnd = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ViewHeader(prefix: "Time to ", em: "focus", icon: "hourglass",
                           sub: "Deep work, one session at a time.") { EmptyView() }
                if store.state.timer != nil {
                    runningCard
                } else {
                    setupCard
                }
                manualCard
                historyCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $showSkillEditor) {
            SkillEditorView(store: store) { sk in
                if let sk { selSkillId = sk.id }
            }
            .environment(\.theme, theme)
        }
    }

    // MARK: tabs

    private func tabs(active: String) -> some View {
        HStack(spacing: 4) {
            ForEach([("focus", "Focus"), ("short", "Short break"), ("long", "Long break")], id: \.0) { key, label in
                Button {
                    guard key != active else { return }
                    Sfx.shared.click()
                    switchTab(key)
                } label: {
                    Text(label)
                        .font(.quicksandBold(12.5))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(active == key ? theme.oliveSoft : .clear))
                        .foregroundColor(active == key ? theme.olive2 : theme.muted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Capsule().fill(theme.card2.opacity(0.7)))
    }

    /// Web behavior: switching away from a running focus logs the elapsed minutes first.
    private func switchTab(_ target: String) {
        selTab = target
        guard let t = store.state.timer else { return }
        let mins = t.phase == "work" ? Int(store.timerElapsedSec() / 60) : 0
        let skillId = t.skillId
        store.state.timer = nil
        LiveActivityController.shared.end()
        if mins >= 1, let skillId {
            Sfx.shared.chime()
            store.logSession(skillId: skillId, minutes: mins, source: "timer")
        } else {
            store.save()
        }
    }

    // MARK: setup

    private var setupCard: some View {
        VStack(alignment: .center, spacing: 12) {
            tabs(active: selTab)
            if selTab == "focus" {
                focusSetup
            } else {
                breakSetup
            }
        }
        .frame(maxWidth: .infinity)
        .card(padding: 18)
    }

    private var focusSetup: some View {
        VStack(spacing: 12) {
            BloomTitle(prefix: "Grow some ", em: "focus", size: 21)
            Text("Pick a plant, pick a time. Every focused minute becomes XP.")
                .font(.quicksand(13)).foregroundColor(theme.muted)
                .multilineTextAlignment(.center)

            if store.state.skills.isEmpty {
                Button {
                    showSkillEditor = true
                } label: {
                    HStack(spacing: 6) { Ic(name: "pot", size: 14); Text("Plant your first skill") }
                }
                .buttonStyle(PillButtonStyle(kind: .primaryBig))
                .padding(.vertical, 8)
            } else {
                FlowChips(spacing: 6) {
                    ForEach(store.state.skills) { sk in
                        let sel = effectiveSkillId == sk.id
                        Button {
                            selSkillId = sel ? FREE : sk.id
                            Sfx.shared.click()
                        } label: {
                            HStack(spacing: 4) {
                                Ic(name: sk.icon, size: 11)
                                Text(sk.name).font(.quicksandBold(12.5))
                            }
                            .padding(.horizontal, 11)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(sel ? Color(hex: sk.color) : theme.card2))
                            .foregroundColor(sel ? .white : theme.ink)
                            .overlay(Capsule().stroke(sel ? .clear : theme.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                    Button {
                        showSkillEditor = true
                    } label: {
                        Text("＋ new").font(.quicksandBold(12.5))
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(Capsule().fill(theme.card2))
                            .foregroundColor(theme.muted)
                            .overlay(Capsule().stroke(theme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 6) {
                ForEach([15, 25, 45, 60], id: \.self) { d in
                    Button {
                        selDur = d
                        customDur = ""
                        Sfx.shared.click()
                    } label: {
                        Text("\(d)m").font(.quicksandBold(13))
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background(Capsule().fill(selDur == d ? theme.olive : theme.card2))
                            .foregroundColor(selDur == d ? Color(hex: "#FFFDF4") : theme.ink)
                            .overlay(Capsule().stroke(selDur == d ? .clear : theme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                TextField("---", text: $customDur)
                    .keyboardType(.numberPad)
                    .font(.quicksandBold(13))
                    .multilineTextAlignment(.center)
                    .frame(width: 52)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(theme.card2))
                    .overlay(Capsule().stroke(theme.line, lineWidth: 1))
                    .onChange(of: customDur) {
                        if let v = Int(customDur), v > 0 { selDur = min(v, 240) }
                    }
            }

            Button {
                store.startTimer(skillId: effectiveSkillId == FREE ? nil : effectiveSkillId, minutes: selDur)
            } label: {
                Text("Start \(selDur)m of focus")
            }
            .buttonStyle(PillButtonStyle(kind: .primaryBig))
        }
    }

    private var effectiveSkillId: String? {
        if let id = selSkillId {
            if id == FREE { return FREE }
            if store.skill(id) != nil { return id }
        }
        return store.state.skills.last?.id ?? FREE
    }

    private var breakSetup: some View {
        let isShort = selTab == "short"
        let presets = isShort ? [5, 10] : [15, 20, 30]
        let sel = isShort ? selShort : selLong
        return VStack(spacing: 12) {
            BloomTitle(prefix: "Take a ", em: "break", icon: "leaf", size: 21)
            Text("Rest is part of growing. Nothing gets logged — just breathe.")
                .font(.quicksand(13)).foregroundColor(theme.muted)
                .multilineTextAlignment(.center)
            HStack(spacing: 6) {
                ForEach(presets, id: \.self) { b in
                    Button {
                        if isShort { selShort = b } else { selLong = b }
                        customBreak = ""
                        Sfx.shared.click()
                    } label: {
                        Text("\(b)m").font(.quicksandBold(13))
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background(Capsule().fill(sel == b ? theme.olive : theme.card2))
                            .foregroundColor(sel == b ? Color(hex: "#FFFDF4") : theme.ink)
                            .overlay(Capsule().stroke(sel == b ? .clear : theme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                TextField("---", text: $customBreak)
                    .keyboardType(.numberPad)
                    .font(.quicksandBold(13))
                    .multilineTextAlignment(.center)
                    .frame(width: 52)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(theme.card2))
                    .overlay(Capsule().stroke(theme.line, lineWidth: 1))
                    .onChange(of: customBreak) {
                        if let v = Int(customBreak), v > 0 {
                            if isShort { selShort = min(v, 120) } else { selLong = min(v, 120) }
                        }
                    }
            }
            Button {
                store.startBreak(minutes: isShort ? selShort : selLong)
            } label: {
                Text("Start \(isShort ? selShort : selLong)m break")
            }
            .buttonStyle(PillButtonStyle(kind: .primaryBig))
        }
    }

    // MARK: running

    private var runningCard: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { _ in
            if let t = store.state.timer {
                let free = store.skill(t.skillId) == nil
                let sk = store.skill(t.skillId)
                let onBreak = t.phase == "break"
                let paused = t.pausedAt != nil
                let rem = store.timerRemaining()
                let progress = t.durationSec > 0 ? 1 - rem / t.durationSec : 1
                let ringColor = onBreak ? Color(hex: "#7FA98F") : Color(hex: sk?.color ?? "#8FA35E")

                VStack(spacing: 12) {
                    tabs(active: onBreak ? (selTab == "long" ? "long" : "short") : "focus")

                    if paused {
                        BloomTitle(prefix: "Paused", em: "", size: 21)
                    } else if onBreak {
                        BloomTitle(prefix: "Little ", em: "break", icon: "leaf", size: 21)
                    } else if free {
                        BloomTitle(prefix: "Just ", em: "focusing", icon: "hourglass", size: 21)
                    } else {
                        BloomTitle(prefix: "Growing ", em: sk?.name ?? "", icon: "drop", size: 21)
                    }

                    Text(subText(t, free: free, onBreak: onBreak))
                        .font(.quicksand(12.5)).foregroundColor(theme.muted)
                        .multilineTextAlignment(.center)

                    ZStack {
                        Circle().stroke(theme.track, lineWidth: 10)
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(ringColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        VStack(spacing: 2) {
                            Text(fmtClock(rem))
                                .font(.display(44))
                                .monospacedDigit()
                                .foregroundColor(theme.inkStrong)
                            Text(onBreak ? "breathe" : (sk?.name ?? "focus"))
                                .font(.quicksandBold(13))
                                .foregroundColor(theme.muted)
                        }
                    }
                    .frame(width: 210, height: 210)
                    .padding(.vertical, 6)

                    HStack(spacing: 8) {
                        Button {
                            store.togglePause()
                        } label: {
                            HStack(spacing: 5) { Ic(name: paused ? "play" : "pause", size: 12); Text(paused ? "Resume" : "Pause") }
                        }
                        .buttonStyle(PillButtonStyle())

                        if onBreak {
                            Button {
                                store.skipBreak()
                            } label: {
                                HStack(spacing: 5) { Ic(name: "play", size: 12); Text("Skip break") }
                            }
                            .buttonStyle(PillButtonStyle(kind: .green))
                        } else {
                            Button {
                                store.endEarly()
                            } label: {
                                HStack(spacing: 5) { Ic(name: "check", size: 12); Text(free ? "Finish" : "Finish & log") }
                            }
                            .buttonStyle(PillButtonStyle(kind: .green))
                        }

                        Button {
                            store.zenPresented = true
                        } label: {
                            HStack(spacing: 5) { Ic(name: "expand", size: 12); Text("Zen") }
                        }
                        .buttonStyle(PillButtonStyle())
                    }

                    Button(onBreak ? (t.mode == "cycle" ? "End cycle" : "End break") : "End") {
                        if onBreak {
                            store.endEarly()
                        } else {
                            confirmEnd = true
                        }
                    }
                    .buttonStyle(PillButtonStyle(kind: .danger))
                }
                .frame(maxWidth: .infinity)
                .card(padding: 18)
                .alert(endMessage(t, free: free), isPresented: $confirmEnd) {
                    Button("Keep going", role: .cancel) {}
                    Button("End session", role: .destructive) { store.endEarly() }
                }
            }
        }
    }

    private func subText(_ t: TimerState, free: Bool, onBreak: Bool) -> String {
        if onBreak {
            if t.mode != "cycle" { return "just a breather — nothing gets logged" }
            if t.round == 0 { return "warm-up break · \(store.skill(t.skillId)?.name ?? "focus") starts after this" }
            return "round \(t.round) done · back to \(store.skill(t.skillId)?.name ?? "focus") after this"
        }
        if t.mode == "cycle" {
            return "round \(t.round) · \(fmtMin(Int(t.workSec / 60))) work + \(fmtMin(Int(t.breakSec / 60))) break, repeating"
        }
        return free
            ? "\(fmtMin(Int(t.durationSec / 60))) timer · no plant — nothing gets logged"
            : "\(fmtMin(Int(t.durationSec / 60))) session · every minute = 1 XP"
    }

    private func endMessage(_ t: TimerState, free: Bool) -> String {
        let elapsedMin = Int(store.timerElapsedSec() / 60)
        if free { return "End this timer? No plant selected, so nothing gets logged." }
        if elapsedMin >= 1 { return "End this session early? Your \(fmtMin(elapsedMin)) still gets logged — no minute wasted." }
        return "End this session? Nothing to log yet (under a minute)."
    }

    // MARK: manual + history

    private var manualCard: some View {
        VStack(alignment: .leading, spacing: 13) {
            BloomTitle(prefix: "Add ", em: "time", icon: "pencil")
            QuickLogBox(store: store)
            Text("Works for the past too — “30m piano yesterday” or “1h math 2026-07-01”.")
                .font(.quicksand(11.5)).foregroundColor(theme.muted)
        }
        .card()
    }

    private var historyCard: some View {
        let sessions = store.state.sessions.sorted { $0.at > $1.at }.prefix(10)
        return VStack(alignment: .leading, spacing: 13) {
            HStack {
                BloomTitle(prefix: "Recent ", em: "sessions", icon: "clock")
                Spacer()
                Chip(text: "\(fmtMin(store.minutesTotal())) all-time", style: .green)
            }
            if sessions.isEmpty {
                EmptyState(icon: "hourglass", text: "No sessions yet — start the timer or add time above.")
            }
            ForEach(Array(sessions)) { sess in
                let sk = store.skill(sess.skillId)
                HStack(spacing: 8) {
                    Ic(name: sk?.icon ?? "hourglass", size: 12).foregroundColor(theme.olive)
                    Text(sk?.name ?? (sess.skillId != nil ? "(removed)" : "just focus"))
                        .font(.quicksand(13.5)).foregroundColor(theme.ink)
                        .lineLimit(1)
                    Chip(text: fmtMin(sess.minutes), style: .green)
                    Text("\(fmtDateShort(sess.date)) · \(sess.source == "timer" ? "timer" : "logged")")
                        .font(.quicksand(11)).foregroundColor(theme.muted)
                    Spacer()
                    Button {
                        store.deleteSession(sess.id)
                    } label: {
                        Ic(name: "trash", size: 13).foregroundColor(theme.muted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 4)
            }
        }
        .card()
    }
}

// MARK: - Zen fullscreen

struct ZenView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    @State private var lastLevel = 0

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { _ in
            ZStack {
                theme.bg.ignoresSafeArea()
                if let t = store.state.timer {
                    let sk = store.skill(t.skillId)
                    let phase = t.phase
                    let rem = store.timerRemaining()
                    let progress = t.durationSec > 0 ? 1 - rem / t.durationSec : 1
                    let ringColor = phase == "break" ? Color(hex: "#7FA98F") : Color(hex: sk?.color ?? "#8FA35E")
                    // the plant grows live: elapsed work minutes count as XP-in-progress
                    let bonus = phase == "work" ? Int(store.timerElapsedSec() / 60) : 0
                    let liveLevel = sk.map { levelForXp(store.xpOf($0.id) + bonus).level } ?? 1

                    VStack(spacing: 24) {
                        Spacer()
                        ZStack {
                            Circle().stroke(theme.track, lineWidth: 8)
                            Circle()
                                .trim(from: 0, to: progress)
                                .stroke(ringColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                            VStack(spacing: 8) {
                                CroppedPlantView(
                                    spec: PlantSpec(id: sk?.id ?? "zen", colorHex: sk?.color ?? "#8FA35E", species: sk?.species),
                                    level: liveLevel, width: 110
                                )
                                .frame(maxHeight: 130, alignment: .bottom)
                                Text(fmtClock(rem))
                                    .font(.display(46))
                                    .monospacedDigit()
                                    .foregroundColor(theme.inkStrong)
                                Text(zenLabel(t, sk: sk))
                                    .font(.quicksandBold(13))
                                    .foregroundColor(theme.muted)
                            }
                        }
                        .frame(width: 320, height: 320)
                        .scaleEffect(0.92 + progress * 0.1)
                        .onChange(of: liveLevel) { _, newLevel in
                            if lastLevel != 0 && newLevel > lastLevel {
                                Sfx.shared.level()
                                store.burstTick += 1
                            }
                            lastLevel = newLevel
                        }
                        Spacer()
                        HStack(spacing: 10) {
                            Button {
                                store.togglePause()
                            } label: {
                                HStack(spacing: 5) {
                                    Ic(name: t.pausedAt != nil ? "play" : "pause", size: 12)
                                    Text(t.pausedAt != nil ? "Resume" : "Pause")
                                }
                            }
                            .buttonStyle(PillButtonStyle())
                            Button {
                                store.zenPresented = false
                            } label: {
                                HStack(spacing: 5) { Ic(name: "expand", size: 12); Text("Leave zen") }
                            }
                            .buttonStyle(PillButtonStyle())
                        }
                        .padding(.bottom, 30)
                    }
                } else {
                    Color.clear.onAppear { store.zenPresented = false }
                }
            }
        }
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
    }

    private func zenLabel(_ t: TimerState, sk: Skill?) -> String {
        if t.phase == "break" {
            return t.round == 0 ? "warm-up break" : "little break · round \(t.round)"
        }
        let name = sk?.name ?? "focus"
        return t.mode == "cycle" ? "\(name) · round \(t.round)" : name
    }
}

// MARK: - Flow layout for skill chips

struct FlowChips: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: width, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            sub.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}
