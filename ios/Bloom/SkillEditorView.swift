// SkillEditorView.swift — plant a new skill or edit one: live preview, species,
// icon, pot color. Port of skillEditor.js.
import SwiftUI

struct SkillEditorView: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AppStore
    var editing: Skill? = nil
    var onDone: (Skill?) -> Void

    @State private var name = ""
    @State private var icon = "sprout"
    @State private var species: String? = nil
    @State private var color = ""

    private var previewLevel: Int {
        if let editing { return store.levelOf(editing.id).level }
        return name.trimmingCharacters(in: .whitespaces).isEmpty ? 1 : 4
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Capsule().fill(theme.line).frame(width: 36, height: 4)
                    .frame(maxWidth: .infinity).padding(.top, 10)

                if editing != nil {
                    BloomTitle(prefix: "Edit ", em: "plant", size: 22)
                } else {
                    BloomTitle(prefix: "Plant a new ", em: "skill", size: 22)
                    Text("Anything you want to get better at — it becomes a plant in your garden.")
                        .font(.quicksand(12.5)).foregroundColor(theme.muted)
                }

                PlantView(spec: PlantSpec(id: editing?.id ?? "preview", colorHex: color, species: species), level: previewLevel, sway: true)
                    .frame(height: 120)
                    .frame(maxWidth: .infinity)

                fieldLabel("Name")
                TextField("e.g. Math, Piano, Spanish…", text: $name)
                    .textFieldStyle(BloomFieldStyle())

                fieldLabel("Species")
                HStack(spacing: 6) {
                    ForEach(PLANT_SPECIES, id: \.key) { key, label in
                        let sel = (species ?? "bloom") == key
                        Button {
                            species = key
                            Sfx.shared.click()
                        } label: {
                            VStack(spacing: 2) {
                                PlantView(spec: PlantSpec(id: "sp-\(key)", colorHex: color, species: key), level: 6)
                                    .frame(height: 44)
                                Text(label).font(.quicksand(9.5)).foregroundColor(theme.muted)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(sel ? theme.oliveSoft : theme.card2.opacity(0.5)))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(sel ? theme.olive : .clear, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }

                fieldLabel("Icon")
                let iconCols = [GridItem](repeating: GridItem(.flexible(), spacing: 6), count: 8)
                LazyVGrid(columns: iconCols, spacing: 6) {
                    ForEach(SKILL_ICONS, id: \.self) { ic in
                        Button {
                            icon = ic
                            Sfx.shared.click()
                        } label: {
                            Ic(name: ic, size: 15)
                                .frame(width: 34, height: 34)
                                .background(RoundedRectangle(cornerRadius: 10).fill(icon == ic ? theme.oliveSoft : theme.card2.opacity(0.5)))
                                .foregroundColor(icon == ic ? theme.olive2 : theme.muted)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(icon == ic ? theme.olive : .clear, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }

                fieldLabel("Pot color")
                HStack(spacing: 8) {
                    ForEach(PALETTE, id: \.self) { c in
                        Button {
                            color = c
                            Sfx.shared.click()
                        } label: {
                            Circle()
                                .fill(Color(hex: c))
                                .frame(width: 26, height: 26)
                                .overlay(Circle().stroke(theme.inkStrong.opacity(color == c ? 0.7 : 0), lineWidth: 2).padding(-3))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button(editing != nil ? "Save" : "Plant it") {
                    save()
                }
                .buttonStyle(PillButtonStyle(kind: .primaryBig))
                .frame(maxWidth: .infinity)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .padding(.horizontal, 22)
        }
        .background(theme.bg)
        .onAppear {
            if let editing {
                name = editing.name
                icon = editing.icon
                species = editing.species
                color = editing.color
            } else {
                color = store.nextColor()
            }
        }
        .onChange(of: name) {
            // fresh plant gets a guessed icon as you type, like the quick log does
            if editing == nil, icon == "sprout" || SKILL_ICONS.contains(icon) {
                let guessed = guessIcon(name)
                if guessed != "sprout" { icon = guessed }
            }
        }
    }

    private func fieldLabel(_ s: String) -> some View {
        Text(s.uppercased()).font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted).padding(.top, 4)
    }

    private func save() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        if var sk = editing {
            sk.name = n; sk.icon = icon; sk.color = color; sk.species = species
            store.updateSkill(sk)
            onDone(sk)
        } else {
            let sk = store.addSkill(name: n, icon: icon, color: color, species: species ?? "bloom")
            onDone(sk)
        }
        dismiss()
    }
}
