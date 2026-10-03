// TasksView.swift — task rows + add form. One list for the day (due today, still
// open from earlier, undated), plant filter, done-today drawer. Later-dated tasks
// live on their day in the calendar. Tasks give no XP — only focused time grows plants.
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
        let hasChips = (showDue && task.due != nil && !task.done) || task.repeatRule != nil || sk != nil
        if hasChips {
            HStack(spacing: 5) {
                if showDue, let due = task.due, !task.done {
                    let diff = dayDiff(todayYmd(), due)
                    Chip(text: relDue(due), icon: "calendar", style: diff < 0 ? .overdue : diff == 0 ? .dueToday : .plain)
                }
                if let r = task.repeatRule { Chip(text: r.capitalized, icon: "repeat", style: .lilac) }
                if let sk { Chip(text: sk.name, icon: sk.icon) }
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
    @State private var draftRepeat: String? = nil
    @State private var filterSkill: String? = nil
    @State private var showDatePicker = false
    @State private var showSkillEditor = false

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
        // This page is just the day's list: due today, still-open from earlier, and
        // undated ("do it whenever") — no Late/Someday shelves. Future-dated tasks
        // live on their own day in the calendar; addTask() already toasts to say so.
        let forToday = open.filter { ($0.due ?? today) <= today }.sorted(by: bySort)
        let laterCount = open.filter { ($0.due ?? today) > today }.count

        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ViewHeader(prefix: "Your ", em: "tasks", icon: "check-square",
                           sub: "Link a task to a plant to keep its work in one place.") { EmptyView() }

                addForm

                VStack(alignment: .leading, spacing: 10) {
                    if !store.state.skills.isEmpty { filterRow }
                    if forToday.isEmpty {
                        EmptyState(icon: "leaf", text: emptyText(laterCount: laterCount))
                    }
                    ForEach(forToday) { t in
                        TaskRow(store: store, task: t, showDue: false)
                    }
                    if !forToday.isEmpty && laterCount > 0 { laterHint(laterCount) }
                    if !doneTasks.isEmpty { doneSection(doneTasks) }
                }
                .card()
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 28)
            .pageColumn(940)
        }
        .scrollDismissesKeyboard(.interactively)
        .fullScreenCover(isPresented: $showSkillEditor) {
            SkillEditorView(store: store) { sk in
                if let sk { draftSkillId = sk.id }
            }
            .iPadComfortScale()
            .environment(\.theme, theme)
        }
    }

    private func emptyText(laterCount: Int) -> String {
        if filterSkill != nil { return "No open tasks for this plant." }
        if laterCount > 0 {
            return laterCount == 1
                ? "Nothing for today — 1 task is waiting on a later day."
                : "Nothing for today — \(laterCount) tasks are waiting on later days."
        }
        return "Nothing to do — add your first task above!"
    }

    /// Future-dated tasks aren't listed here; point at the calendar so they're findable.
    private func laterHint(_ count: Int) -> some View {
        Text(count == 1 ? "1 more waiting on a later day — see the calendar."
                        : "\(count) more waiting on later days — see the calendar.")
            .font(.quicksand(12))
            .foregroundColor(theme.muted)
            .padding(.top, 4)
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
                        Chip(text: draftDue.map { fmtDateShort(ymd($0)) } ?? "Due date", icon: "calendar", selected: draftDue != nil)
                    }
                    .buttonStyle(.plain)
                    // repeat
                    Menu {
                        Button("No repeat") { draftRepeat = nil }
                        Button("Daily") { draftRepeat = "daily" }
                        Button("Weekly") { draftRepeat = "weekly" }
                        Button("Monthly") { draftRepeat = "monthly" }
                    } label: {
                        Chip(text: draftRepeat?.capitalized ?? "Repeat", icon: "repeat", selected: draftRepeat != nil)
                    }
                    // plant link
                    Menu {
                        Button("No plant") { draftSkillId = nil }
                        ForEach(store.state.skills) { sk in
                            Button(sk.name) { draftSkillId = sk.id }
                        }
                        Button("＋ Plant new skill…") { showSkillEditor = true }
                    } label: {
                        Chip(text: store.skill(draftSkillId)?.name ?? "Link a plant",
                             icon: store.skill(draftSkillId)?.icon ?? "pot",
                             selected: draftSkillId != nil)
                    }
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
                      priority: 0, repeatRule: draftRepeat)
        draftTitle = ""; draftDue = nil; draftSkillId = nil; draftRepeat = nil
    }
}
