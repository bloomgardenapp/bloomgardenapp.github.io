// GardenView.swift — the progression garden: meadow scene, tier ladder, plant cards,
// plant details, the plant book, and the keepsake shelf.
import SwiftUI

struct GardenView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    var openSettings: () -> Void

    @State private var stripSkillId: String? = nil
    @State private var detailSkillId: String? = nil
    @State private var showSkillEditor = false
    @State private var showPlantBook = false

    private var sortedSkills: [Skill] {
        store.state.skills.sorted {
            let (a, b) = (store.weekMinutes($0.id), store.weekMinutes($1.id))
            return a != b ? a > b : store.xpOf($0.id) > store.xpOf($1.id)
        }
    }

    var body: some View {
        let skills = sortedSkills
        let total = store.minutesTotal()
        let topSk = stripSkillId.flatMap { id in skills.first { $0.id == id } } ?? skills.first

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ViewHeader(prefix: "Your ", em: "garden", icon: "sprout",
                           sub: skills.isEmpty
                               ? "Every skill you practice becomes a plant."
                               : "Look what your focus grew.") {
                    HStack(spacing: 6) {
                        Button { Sfx.shared.click(); showPlantBook = true } label: {
                            Ic(name: "book", size: 15).foregroundColor(theme.muted)
                                .padding(8)
                                .background(Circle().fill(theme.card))
                                .overlay(Circle().stroke(theme.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        Button { openSettings() } label: {
                            Ic(name: "gear", size: 15).foregroundColor(theme.muted)
                                .padding(8)
                                .background(Circle().fill(theme.card))
                                .overlay(Circle().stroke(theme.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }

                banner(skills: skills, total: total)

                if let topSk {
                    TierStrip(store: store, tier: store.tier(topSk.id), capLabel: "\(topSk.name) now", plantName: topSk.name)
                }

                if skills.isEmpty {
                    EmptyState(icon: "pot", text: "Your garden is empty! Type something like “30m math” in Today, or plant a skill.")
                        .card()
                } else {
                    plantGrid(skills: skills, topId: topSk?.id)
                }

                Button {
                    showSkillEditor = true
                } label: {
                    HStack(spacing: 6) { Ic(name: "pot", size: 14); Text("Plant a new skill") }
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PillButtonStyle(kind: .primaryBig))

                keepsakeShelf
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .sheet(isPresented: $showSkillEditor) {
            SkillEditorView(store: store) { _ in }
                .environment(\.theme, theme)
        }
        .sheet(isPresented: $showPlantBook) {
            PlantBookView(store: store)
                .environment(\.theme, theme)
        }
        .sheet(item: Binding(
            get: { detailSkillId.flatMap { id in store.state.skills.first { $0.id == id } } },
            set: { detailSkillId = $0?.id }
        )) { sk in
            SkillDetailsView(store: store, skillId: sk.id)
                .environment(\.theme, theme)
        }
    }

    // MARK: banner

    private func banner(skills: [Skill], total: Int) -> some View {
        ZStack(alignment: .top) {
            if skills.isEmpty {
                GardenHillsView()
                    .aspectRatio(1000 / 240, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            } else {
                GardenSceneView(
                    plants: skills.map { ScenePlant(spec: PlantSpec(id: $0.id, colorHex: $0.color, species: $0.species), level: store.levelOf($0.id).level, name: $0.name) },
                    selectedId: stripSkillId ?? skills.first?.id,
                    onTap: { id in Sfx.shared.click(); stripSkillId = id }
                )
            }
            VStack(spacing: 2) {
                Text(total > 0 ? "YOU'VE GROWN \(fmtMin(total).uppercased())" : "YOUR GARDEN AWAITS")
                    .font(.quicksandBold(13))
                    .kerning(1.2)
                Text(total > 0
                     ? "\(skills.count) \(skills.count == 1 ? "plant" : "plants") in your garden · \(store.streak()) day streak"
                     : "log a first session to start growing")
                    .font(.quicksand(11))
            }
            .foregroundColor(theme.isDark ? theme.ink : Color(hex: "#3A422C"))
            .frame(maxWidth: .infinity)
            .padding(.top, 14)
        }
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(theme.line, lineWidth: 1))
    }

    // MARK: plant cards

    private func plantGrid(skills: [Skill], topId: String?) -> some View {
        let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: cols, spacing: 10) {
            ForEach(skills) { sk in
                plantCard(sk, selected: sk.id == topId)
            }
        }
    }

    private func plantCard(_ sk: Skill, selected: Bool) -> some View {
        let lv = store.levelOf(sk.id)
        return VStack(spacing: 6) {
            HStack {
                Chip(text: "lv \(lv.level) · \(stageName(lv.level))", style: .lilac)
                Spacer()
            }
            PlantView(spec: PlantSpec(id: sk.id, colorHex: sk.color, species: sk.species), level: lv.level, sway: true)
                .frame(height: 110)
                .onTapGesture {
                    Sfx.shared.click()
                    stripSkillId = sk.id
                }
            HStack(spacing: 4) {
                Ic(name: sk.icon, size: 12)
                Text(sk.name).font(.quicksandBold(13.5))
            }
            .foregroundColor(theme.inkStrong)
            .lineLimit(1)
            XPBar(progress: Double(lv.into) / Double(lv.need), height: 6)
            Text("\(fmtMin(store.minutesTotal(sk.id))) total · \(fmtMin(store.weekMinutes(sk.id))) this wk")
                .font(.quicksand(10.5)).foregroundColor(theme.muted)
                .lineLimit(1).minimumScaleFactor(0.8)
            BarChart(values: store.lastNDays(7, skillId: sk.id), labels: [], height: 26)
            HStack(spacing: 6) {
                Button("Details") { detailSkillId = sk.id }
                    .buttonStyle(PillButtonStyle())
            }
        }
        .card(padding: 12)
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(selected ? theme.olive.opacity(0.5) : .clear, lineWidth: 2))
    }

    // MARK: keepsakes

    private var keepsakeShelf: some View {
        let earned = KEEPSAKES.filter { $0.test(store) }
        let cols = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                BloomTitle(prefix: "Keepsake ", em: "shelf", icon: "star")
                Spacer()
                Chip(text: "\(earned.count) of \(KEEPSAKES.count)", style: .lilac)
            }
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(KEEPSAKES) { k in
                    let got = k.test(store)
                    VStack(spacing: 4) {
                        Ic(name: k.icon, size: 17)
                            .foregroundColor(got ? theme.olive2 : theme.muted.opacity(0.5))
                        Text(k.name)
                            .font(.quicksandBold(10.5))
                            .foregroundColor(got ? theme.inkStrong : theme.muted)
                            .multilineTextAlignment(.center)
                        Text(got ? "earned" : k.how)
                            .font(.quicksand(9))
                            .foregroundColor(theme.muted)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .padding(.horizontal, 4)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(got ? theme.oliveSoft.opacity(0.6) : theme.card2.opacity(0.5)))
                    .opacity(got ? 1 : 0.75)
                }
            }
        }
        .card()
    }
}

// MARK: - Tier strip (Seed → Sprout → … ladder)

struct TierStrip: View {
    @Environment(\.theme) private var theme
    var store: AppStore
    var tier: TierInfo
    var capLabel: String
    var plantName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            XPBar(progress: max(0.02, tier.progress), height: 7)
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("[0\(tier.index + 1)]").font(.quicksandBold(10)).foregroundColor(theme.muted)
                    HStack(spacing: 4) {
                        Ic(name: tier.cur.icon, size: 13)
                        Text(tier.cur.name).font(.quicksandBold(13))
                    }
                    .foregroundColor(theme.inkStrong)
                    Text(capLabel).font(.quicksand(10)).foregroundColor(theme.muted)
                }
                Spacer()
                Text(tier.next != nil
                     ? "grow \(plantName) \(fmtMin(tier.minutesToNext)) more to reach \(tier.next!.name)"
                     : "\(plantName) is a whole forest")
                    .font(.quicksand(11))
                    .foregroundColor(theme.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 150)
                Spacer()
                if let next = tier.next {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("[0\(tier.index + 2)]").font(.quicksandBold(10)).foregroundColor(theme.muted)
                        HStack(spacing: 4) {
                            Ic(name: next.icon, size: 13)
                            Text(next.name).font(.quicksandBold(13))
                        }
                        .foregroundColor(theme.inkStrong)
                        Text("at \(Int(next.hours))h").font(.quicksand(10)).foregroundColor(theme.muted)
                    }
                }
            }
        }
        .card(padding: 14)
    }
}

// MARK: - Skill details sheet

struct SkillDetailsView: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AppStore
    var skillId: String

    @State private var showEditor = false
    @State private var confirmUproot = false

    var body: some View {
        if let sk = store.state.skills.first(where: { $0.id == skillId }) {
            let lv = store.levelOf(sk.id)
            let sessions = store.state.sessions.filter { $0.skillId == sk.id }.sorted { $0.at > $1.at }
            let openTasks = store.state.tasks.filter { !$0.done && $0.skillId == sk.id }

            ScrollView {
                VStack(spacing: 14) {
                    Capsule().fill(theme.line).frame(width: 36, height: 4).padding(.top, 10)
                    PlantView(spec: PlantSpec(id: sk.id, colorHex: sk.color, species: sk.species), level: lv.level, sway: true)
                        .frame(height: 140)
                    HStack(spacing: 6) {
                        Ic(name: sk.icon, size: 16)
                        Text(sk.name).font(.display(21))
                    }
                    .foregroundColor(theme.inkStrong)
                    HStack(spacing: 6) {
                        Chip(text: "lv \(lv.level) · \(stageName(lv.level))", style: .lilac)
                        Chip(text: "\(store.xpOf(sk.id)) XP", style: .green)
                        Chip(text: "\(fmtMin(store.minutesTotal(sk.id))) total")
                    }
                    VStack(spacing: 4) {
                        XPBar(progress: Double(lv.into) / Double(lv.need))
                        Text("\(lv.need - lv.into) XP to level \(lv.level + 1) — that's ~\(fmtMin(lv.need - lv.into)) of focus")
                            .font(.quicksand(11.5)).foregroundColor(theme.muted)
                    }
                    .padding(.horizontal, 16)

                    TierStrip(store: store, tier: store.tier(sk.id), capLabel: "\(sk.name) now", plantName: sk.name)
                        .padding(.horizontal, 16)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("LAST 14 DAYS").font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted)
                        BarChart(values: store.lastNDays(14, skillId: sk.id), labels: [], height: 48)

                        Text("SESSIONS · \(sessions.count)").font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted)
                            .padding(.top, 6)
                        if sessions.isEmpty {
                            Text("No time logged yet.").font(.quicksand(12.5)).foregroundColor(theme.muted)
                        }
                        ForEach(sessions.prefix(8)) { sess in
                            HStack(spacing: 8) {
                                Chip(text: fmtMin(sess.minutes), style: .green)
                                Text("\(fmtDateShort(sess.date)) · \(sess.source == "timer" ? "timer" : "logged")")
                                    .font(.quicksand(11.5)).foregroundColor(theme.muted)
                                Spacer()
                                Button { store.deleteSession(sess.id) } label: {
                                    Ic(name: "trash", size: 13).foregroundColor(theme.muted)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if !openTasks.isEmpty {
                            Text("OPEN TASKS · \(openTasks.count)").font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted)
                                .padding(.top, 6)
                            ForEach(openTasks.prefix(5)) { t in
                                TaskRow(store: store, task: t)
                            }
                        }
                    }
                    .padding(.horizontal, 16)

                    HStack(spacing: 8) {
                        Button("Uproot") { confirmUproot = true }
                            .buttonStyle(PillButtonStyle(kind: .danger))
                        Button {
                            showEditor = true
                        } label: {
                            HStack(spacing: 5) { Ic(name: "pencil", size: 12); Text("Edit") }
                        }
                        .buttonStyle(PillButtonStyle())
                    }
                    .padding(.bottom, 24)
                }
            }
            .background(theme.bg)
            .alert("Uproot \(sk.name)? Its \(sessions.count) sessions and XP disappear. Linked tasks & notes stay (unlinked).", isPresented: $confirmUproot) {
                Button("Cancel", role: .cancel) {}
                Button("Uproot", role: .destructive) {
                    store.uprootSkill(sk.id)
                    dismiss()
                }
            }
            .sheet(isPresented: $showEditor) {
                SkillEditorView(store: store, editing: sk) { _ in }
                    .environment(\.theme, theme)
            }
        }
    }
}

// MARK: - Plant book

struct PlantBookView: View {
    @Environment(\.theme) private var theme
    var store: AppStore

    private static let stages: [(name: String, lv: Int, need: Int)] = [
        ("sprout", 1, 1), ("bud", 4, 3), ("bloom", 8, 7), ("radiant", 12, 10),
    ]
    private static let bookColors: [String: String] = [
        "bloom": "#C97F5F", "sunflower": "#E0B54F", "cactus": "#8FA35E", "fern": "#7FA98F", "bonsai": "#A9906E",
    ]

    var body: some View {
        var maxBySpecies: [String: Int] = [:]
        for sk in store.state.skills {
            let key = sk.speciesOrDefault
            maxBySpecies[key] = max(maxBySpecies[key] ?? 0, store.levelOf(sk.id).level)
        }
        var found = 0
        for (key, _) in PLANT_SPECIES {
            let maxLv = maxBySpecies[key] ?? 0
            for st in Self.stages where st.need <= 1 || maxLv >= st.need { found += 1 }
        }
        let total = PLANT_SPECIES.count * Self.stages.count

        return ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Capsule().fill(theme.line).frame(width: 36, height: 4)
                    .frame(maxWidth: .infinity).padding(.top, 10)
                BloomTitle(prefix: "Plant ", em: "book", size: 22)
                Text("Every plant grows through four stages. Keep watering to reveal them all.")
                    .font(.quicksand(12.5)).foregroundColor(theme.muted)
                Chip(text: "\(found) of \(total) discovered", style: .green)

                ForEach(PLANT_SPECIES, id: \.key) { key, label in
                    let maxLv = maxBySpecies[key] ?? 0
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text(label).font(.quicksandBold(14)).foregroundColor(theme.inkStrong)
                            if maxLv > 0 { Chip(text: "lv \(maxLv)", style: .lilac) }
                            else { Text("not planted").font(.quicksand(11)).foregroundColor(theme.muted) }
                        }
                        HStack(spacing: 8) {
                            ForEach(Self.stages, id: \.name) { st in
                                let unlocked = st.need <= 1 || maxLv >= st.need
                                VStack(spacing: 3) {
                                    PlantView(spec: PlantSpec(id: "bk-\(key)-\(st.lv)", colorHex: Self.bookColors[key] ?? "#C97F5F", species: key), level: st.lv)
                                        .frame(height: 64)
                                        .saturation(unlocked ? 1 : 0)
                                        .opacity(unlocked ? 1 : 0.25)
                                    Text(unlocked ? st.name : "?")
                                        .font(.quicksand(10)).foregroundColor(theme.muted)
                                }
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                    .card(padding: 12)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(theme.bg)
    }
}
