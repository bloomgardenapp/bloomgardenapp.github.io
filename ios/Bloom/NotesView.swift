// NotesView.swift — notes.js ported: searchable pinned-first list, color-tinted
// cards, autosaving editor with plant links. Web notes can carry rich HTML
// (highlights, checklists) — those render faithfully and are never silently
// flattened; editing their text is an explicit choice.
import SwiftUI

private func stripHTML(_ html: String) -> String {
    html.replacingOccurrences(of: "<br\\s*/?>", with: " ", options: [.regularExpression, .caseInsensitive])
        .replacingOccurrences(of: "</(p|div|li|ul|ol)>", with: " ", options: [.regularExpression, .caseInsensitive])
        .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        .replacingOccurrences(of: "&amp;", with: "&")
        .replacingOccurrences(of: "&lt;", with: "<")
        .replacingOccurrences(of: "&gt;", with: ">")
        .replacingOccurrences(of: "&nbsp;", with: " ")
}

private func isHTML(_ body: String) -> Bool {
    body.range(of: "<[a-z]", options: [.regularExpression, .caseInsensitive]) != nil
}

private func snippet(_ n: Note) -> String {
    let s = stripHTML(n.body)
        .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespaces)
    if s.isEmpty { return "empty note" }
    return s.count > 64 ? String(s.prefix(64)) + "…" : s
}

struct NotesView: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore

    @State private var selectedId: String? = nil
    @State private var query = ""

    private var sortedNotes: [Note] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        var list = store.state.notes
        if !q.isEmpty {
            list = list.filter { ($0.title + " " + stripHTML($0.body)).lowercased().contains(q) }
        }
        return list.sorted { a, b in
            if a.pinned != b.pinned { return a.pinned }
            return a.updatedAt > b.updatedAt
        }
    }

    var body: some View {
        Group {
            if let id = selectedId, store.state.notes.contains(where: { $0.id == id }) {
                NoteEditor(store: store, noteId: id, back: { selectedId = nil })
            } else {
                notesList
            }
        }
    }

    private var notesList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ViewHeader(prefix: "Little ", em: "notes", icon: "note",
                           sub: "Thoughts, plans, lists — link them to a plant to keep them close.") { EmptyView() }
                HStack(spacing: 8) {
                    TextField("Search notes…", text: $query)
                        .textFieldStyle(BloomFieldStyle())
                    Button("＋ New") {
                        let n = store.addNote()
                        query = ""
                        selectedId = n.id
                    }
                    .buttonStyle(PillButtonStyle(kind: .primary))
                }
                if sortedNotes.isEmpty {
                    EmptyState(icon: "note", text: query.isEmpty ? "No notes yet — write your first one." : "No notes match.")
                }
                ForEach(sortedNotes) { n in
                    noteCard(n)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func noteCard(_ n: Note) -> some View {
        let c = Color(hex: n.color)
        let sk = store.skill(n.skillId)
        return Button {
            Sfx.shared.click()
            selectedId = n.id
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 5) {
                    if n.pinned { Ic(name: "pin", size: 11).foregroundColor(theme.olive2) }
                    Text(n.title.isEmpty ? "Untitled" : n.title)
                        .font(.quicksandBold(14.5)).foregroundColor(theme.inkStrong)
                        .lineLimit(1)
                }
                Text(snippet(n))
                    .font(.quicksand(12.5)).foregroundColor(theme.muted)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let sk { Chip(text: sk.name, icon: sk.icon) }
                    Spacer()
                    Text(relTime(n.updatedAt.isEmpty ? n.createdAt : n.updatedAt))
                        .font(.quicksand(10.5)).foregroundColor(theme.muted)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(c.opacity(theme.isDark ? 0.16 : 0.10)))
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(theme.card))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(c.opacity(0.4), lineWidth: 1.2))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Editor

struct NoteEditor: View {
    @Environment(\.theme) private var theme
    @Bindable var store: AppStore
    var noteId: String
    var back: () -> Void

    @State private var title = ""
    @State private var bodyText = ""            // plain-text editing buffer
    @State private var richBody: AttributedString? = nil
    @State private var editingRich = false      // user chose to flatten a formatted note
    @State private var loaded = false
    @State private var showSaved = false
    @State private var confirmDelete = false
    @State private var confirmFlatten = false
    @State private var saveTask: Task<Void, Never>? = nil

    private var note: Note? { store.state.notes.first { $0.id == noteId } }

    var body: some View {
        let n = note
        let c = Color(hex: n?.color ?? "#D89B8A")

        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Button {
                        flushSave()
                        back()
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "chevron.left").font(.system(size: 13, weight: .semibold))
                            Text("notes").font(.quicksandBold(13))
                        }
                        .foregroundColor(theme.olive2)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    if showSaved {
                        Text("Saved ✓").font(.quicksandBold(11)).foregroundColor(theme.olive2)
                            .transition(.opacity)
                    }
                }

                TextField("Untitled", text: $title)
                    .font(.display(22))
                    .foregroundColor(theme.inkStrong)
                    .onChange(of: title) { queueSave() }

                // meta row: plant link, colors, pin, delete
                HStack(spacing: 8) {
                    Menu {
                        Button("No plant") { store.updateNote(noteId) { $0.skillId = nil } }
                        ForEach(store.state.skills) { sk in
                            Button(sk.name) { store.updateNote(noteId) { $0.skillId = sk.id } }
                        }
                    } label: {
                        Chip(text: store.skill(n?.skillId)?.name ?? "Link a plant",
                             icon: store.skill(n?.skillId)?.icon ?? "pot",
                             selected: n?.skillId != nil)
                    }
                    Spacer()
                    Button {
                        store.updateNote(noteId, mutate: { $0.pinned.toggle() }, silent: false)
                        Sfx.shared.click()
                    } label: {
                        Ic(name: "pin", size: 13)
                            .foregroundColor(n?.pinned == true ? theme.olive2 : theme.muted)
                            .padding(7)
                            .background(Circle().fill(n?.pinned == true ? theme.oliveSoft : theme.card2.opacity(0.6)))
                    }
                    .buttonStyle(.plain)
                    Button { confirmDelete = true } label: {
                        Ic(name: "trash", size: 13).foregroundColor(theme.muted).padding(7)
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 8) {
                    ForEach(PALETTE.prefix(7), id: \.self) { pc in
                        Button {
                            store.updateNote(noteId, mutate: { $0.color = pc }, silent: false)
                            Sfx.shared.click()
                        } label: {
                            Circle().fill(Color(hex: pc)).frame(width: 20, height: 20)
                                .overlay(Circle().stroke(theme.inkStrong.opacity(n?.color == pc ? 0.7 : 0), lineWidth: 2).padding(-3))
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let rich = richBody, !editingRich {
                    // formatted on the web — render faithfully, edit only on purpose
                    Text(rich)
                        .font(.quicksand(14))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                    Button {
                        confirmFlatten = true
                    } label: {
                        HStack(spacing: 5) { Ic(name: "pencil", size: 12); Text("Edit as plain text") }
                    }
                    .buttonStyle(PillButtonStyle())
                    Text("This note was formatted on the web — editing here keeps the words but drops highlights and checkboxes.")
                        .font(.quicksand(10.5)).foregroundColor(theme.muted)
                } else {
                    TextEditor(text: $bodyText)
                        .font(.quicksand(14))
                        .foregroundColor(theme.ink)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 260)
                        .onChange(of: bodyText) { queueSave() }
                }
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(c.opacity(theme.isDark ? 0.14 : 0.09)))
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(theme.card))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(c.opacity(0.45), lineWidth: 1.2))
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear(perform: load)
        .onDisappear(perform: flushSave)
        .alert("Delete “\(note?.title.isEmpty == false ? note!.title : "Untitled")”?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                store.deleteNote(noteId)
                back()
            }
        }
        .alert("Edit as plain text? Highlights and checkboxes from the web version won't survive.", isPresented: $confirmFlatten) {
            Button("Cancel", role: .cancel) {}
            Button("Edit as plain text") {
                editingRich = true
                queueSave()
            }
        }
    }

    private func load() {
        guard !loaded, let n = note else { return }
        loaded = true
        title = n.title
        if isHTML(n.body) {
            bodyText = stripHTML(n.body)
                .replacingOccurrences(of: " +", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            richBody = Self.renderHTML(n.body, theme: theme)
            editingRich = false
        } else {
            bodyText = n.body
            richBody = nil
            editingRich = true
        }
    }

    private func queueSave() {
        guard loaded else { return }
        saveTask?.cancel()
        saveTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            persist()
        }
    }

    private func flushSave() {
        saveTask?.cancel()
        persist()
    }

    private func persist() {
        guard loaded, let n = note else { return }
        let newBody = editingRich ? bodyText : n.body   // rich display mode never rewrites the body
        guard n.title != title || n.body != newBody else { return }
        store.updateNote(noteId) {
            $0.title = title
            $0.body = newBody
        }
        withAnimation { showSaved = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation { showSaved = false }
        }
    }

    /// Web note HTML → AttributedString, with the web's highlight/checklist styling.
    static func renderHTML(_ html: String, theme: BloomTheme) -> AttributedString? {
        let ink = theme.isDark ? "#EAE6DD" : "#4A5238"
        let styled = """
        <style>
        body { font-family: '-apple-system'; font-size: 14px; color: \(ink); }
        mark.hl-sun { background: #F5EDC8; } mark.hl-mint { background: #DFECDC; }
        mark.hl-rose { background: #F2E1DC; } mark.hl-sky { background: #E0EAF0; }
        ul.checks { list-style: none; padding-left: 6px; }
        ul.checks li:before { content: '☐  '; }
        ul.checks li.done:before { content: '☑  '; }
        ul.checks li.done { color: #8F937D; }
        </style>
        \(html)
        """
        guard let data = styled.data(using: .utf8),
              let ns = try? NSAttributedString(
                data: data,
                options: [.documentType: NSAttributedString.DocumentType.html,
                          .characterEncoding: String.Encoding.utf8.rawValue],
                documentAttributes: nil)
        else { return nil }
        return AttributedString(ns)
    }
}
