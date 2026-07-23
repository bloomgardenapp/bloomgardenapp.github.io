// TasksView.swift — task rows + add form. Today / Someday sections, plant filter,
// done-today drawer. Tasks give no XP — only focused time grows plants.
import SwiftUI

struct TaskRow: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    var task: TaskItem
    var showDue: Bool = true

    @State private var editing = false
    @State private var editText = ""

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            CheckButton(checked: task.done) { store.toggleTask(task.id) }
            VStack(alignment: .leading, spacing: 5) {
                if editing {
                    TextField("", text: $editText)
                        .textFieldStyle(BloomFieldStyle())
                        .onSubmit {
                            store.updateTaskTitle(task.id, title: editText.trimmingCharacters(in: .whitespaces))
                            editing = false
                        }
                } else {
                    Text(task.title)
                        .font(.quicksand(14))
                        .strikethrough(task.done)
                        .foregroundColor(task.done ? theme.muted : theme.ink)
                }
                chipsRow
            }
            Spacer(minLength: 4)
            Menu {
                Button {
                    editText = task.title
                    editing = true
                } label: { Label("Edit", systemImage: "pencil") }
                Button(role: .destructive) {
                    store.deleteTask(task.id)
                } label: { Label("Delete", systemImage: "trash") }
            } label: {
                Ic(name: "pencil", size: 13).foregroundColor(theme.muted).padding(6)
            }
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder private var chipsRow: some View {
        let sk = store.skill(task.skillId)
        let hasChips = (showDue && task.due != nil && !task.done) || task.repeatRule != nil || sk != nil || (task.priority > 0 && !task.done)
        if hasChips {
            HStack(spacing: 5) {
                if showDue, let due = task.due, !task.done {
                    let diff = dayDiff(todayYmd(), due)
                    Chip(text: relDue(due), icon: "calendar", style: diff < 0 ? .overdue : diff == 0 ? .dueToday : .plain)
                }
                if let r = task.repeatRule { Chip(text: r, icon: "repeat", style: .lilac) }
                if let sk { Chip(text: sk.name, icon: sk.icon) }
                if task.priority == 2 && !task.done { Chip(text: "‼ high", style: .coral) }
                if task.priority == 1 && !task.done { Chip(text: "! medium", style: .sun) }
            }
        }
    }
}

struct TasksView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore

    @State private var draftTitle = ""
    @State private var draftDue: Date? = nil
    @State private var draftSkillId: String? = nil
    @State private var draftPriority = 0
    @State private var draftRepeat: String? = nil
    @State private var filterSkill: String? = nil
    @State private var showDatePicker = false
    @State private var showSkillEditor = false

    private let prioLabels = ["priority", "! medium", "‼ high"]

    var body: some View {
        let today = todayYmd()
        var open = store.state.tasks.filter { !$0.done }
        if let f = filterSkill { open = open.filter { $0.skillId == f } }
        let doneTasks = store.state.tasks
            .filter { t in t.done && t.doneAt != nil && parseISO(t.doneAt!).map { ymd($0) == today } == true }
            .sorted { ($0.doneAt ?? "") > ($1.doneAt ?? "") }

        let bySort: (TaskItem, TaskItem) -> Bool = { a, b in
            if a.priority != b.priority { return a.priority > b.priority }
            if (a.due ?? "9999") != (b.due ?? "9999") { return (a.due ?? "9999") < (b.due ?? "9999") }
            return a.createdAt < b.createdAt
        }
        let dueToday = open.filter { $0.due == today }.sorted(by: bySort)
        let someday = open.filter { $0.due == nil }.sorted(by: bySort)
        let upcoming = open.filter { ($0.due ?? "") > today }.sorted(by: bySort)
        let overdue = open.filter { $0.due != nil && $0.due! < today }.sorted(by: bySort)

        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ViewHeader(prefix: "Your ", em: "tasks", icon: "check-square",
                           sub: "Link a task to a plant to keep its work in one place.") { EmptyView() }

                addForm

                VStack(alignment: .leading, spacing: 10) {
                    if !store.state.skills.isEmpty { filterRow }
                    if overdue.isEmpty && dueToday.isEmpty && someday.isEmpty && upcoming.isEmpty {
                        EmptyState(icon: "leaf", text: filterSkill == nil
                                   ? "Nothing to do — add your first task above!"
                                   : "No open tasks for this plant.")
                    }
                    section("Late", .overdue, overdue)
                    section("Today", .dueToday, dueToday)
                    section("Upcoming", .lilac, upcoming)
                    section("Someday", .plain, someday)
                    if !doneTasks.isEmpty { doneSection(doneTasks) }
                }
                .card()
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $showSkillEditor) {
            SkillEditorView(store: store) { sk in
                if let sk { draftSkillId = sk.id }
            }
            .environment(\.theme, theme)
        }
    }

    @ViewBuilder private func section(_ label: String, _ style: ChipStyle, _ tasks: [TaskItem]) -> some View {
        if !tasks.isEmpty {
            HStack(spacing: 6) {
                Chip(text: label, style: style)
                Text("\(tasks.count)").font(.quicksandBold(12)).foregroundColor(theme.muted)
            }
            .padding(.top, 6)
            ForEach(tasks) { t in
                TaskRow(store: store, task: t, showDue: label != "Today")
            }
        }
    }

    private func doneSection(_ tasks: [TaskItem]) -> some View {
        DisclosureGroup {
            ForEach(tasks.prefix(30)) { t in
                TaskRow(store: store, task: t)
            }
            Button("Clear completed") {
                let ids = Set(tasks.map(\.id))
                store.state.tasks.removeAll { ids.contains($0.id) }
                store.save()
            }
            .buttonStyle(PillButtonStyle(kind: .danger))
            .padding(.top, 4)
        } label: {
            Text("Done · \(tasks.count)")
                .font(.quicksandBold(13))
                .foregroundColor(theme.muted)
        }
        .tint(theme.muted)
        .padding(.top, 8)
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button { filterSkill = nil; Sfx.shared.click() } label: {
                    Chip(text: "All", selected: filterSkill == nil)
                }
                .buttonStyle(.plain)
                ForEach(store.state.skills) { sk in
                    Button {
                        filterSkill = filterSkill == sk.id ? nil : sk.id
                        Sfx.shared.click()
                    } label: {
                        Chip(text: sk.name, icon: sk.icon, selected: filterSkill == sk.id)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: add form

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Add a task… (e.g. Finish physics worksheet)", text: $draftTitle)
                .textFieldStyle(BloomFieldStyle())
                .onSubmit(submit)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    // due date
                    Button { showDatePicker = true } label: {
                        Chip(text: draftDue.map { fmtDateShort(ymd($0)) } ?? "due?", icon: "calendar", selected: draftDue != nil)
                    }
                    .buttonStyle(.plain)
                    // repeat
                    Menu {
                        Button("no repeat") { draftRepeat = nil }
                        Button("repeats daily") { draftRepeat = "daily" }
                        Button("repeats weekly") { draftRepeat = "weekly" }
                        Button("repeats monthly") { draftRepeat = "monthly" }
                    } label: {
                        Chip(text: draftRepeat ?? "repeat?", icon: "repeat", selected: draftRepeat != nil)
                    }
                    // plant link
                    Menu {
                        Button("no plant") { draftSkillId = nil }
                        ForEach(store.state.skills) { sk in
                            Button(sk.name) { draftSkillId = sk.id }
                        }
                        Button("＋ Plant new skill…") { showSkillEditor = true }
                    } label: {
                        Chip(text: store.skill(draftSkillId)?.name ?? "link a plant?",
                             icon: store.skill(draftSkillId)?.icon ?? "pot",
                             selected: draftSkillId != nil)
                    }
                    // priority
                    Button {
                        draftPriority = (draftPriority + 1) % 3
                        Sfx.shared.click()
                    } label: {
                        Chip(text: prioLabels[draftPriority],
                             style: draftPriority == 2 ? .coral : draftPriority == 1 ? .sun : .plain,
                             selected: false)
                    }
                    .buttonStyle(.plain)
                }
            }
            Button(action: submit) {
                Text("＋ Add task")
            }
            .buttonStyle(PillButtonStyle(kind: .primary))
        }
        .card()
        .sheet(isPresented: $showDatePicker) {
            VStack(spacing: 12) {
                DatePicker("Due date", selection: Binding(
                    get: { draftDue ?? Date() },
                    set: { draftDue = $0 }
                ), displayedComponents: .date)
                .datePickerStyle(.graphical)
                .tint(theme.olive2)
                HStack {
                    Button("No due date") { draftDue = nil; showDatePicker = false }
                        .buttonStyle(PillButtonStyle())
                    Spacer()
                    Button("Done") { showDatePicker = false }
                        .buttonStyle(PillButtonStyle(kind: .primary))
                }
            }
            .padding(20)
            .presentationDetents([.medium])
        }
    }

    private func submit() {
        let title = draftTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        store.addTask(title: title, due: draftDue.map { ymd($0) }, skillId: draftSkillId,
                      priority: draftPriority, repeatRule: draftRepeat)
        draftTitle = ""; draftDue = nil; draftSkillId = nil; draftPriority = 0; draftRepeat = nil
    }
}
