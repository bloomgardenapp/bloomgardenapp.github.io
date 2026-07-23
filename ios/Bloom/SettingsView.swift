// SettingsView.swift — account (email code sign-in + sync status), name, theme,
// sounds, time format, ringer, daily reminder, reset. Port of main.js openSettings.
import SwiftUI

struct SettingsView: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: AppStore

    @State private var cloud = CloudSync.shared
    @State private var email = ""
    @State private var code = ""
    @State private var authStage = "start"    // start | code | busy
    @State private var authMessage = ""
    @State private var confirmReset = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Capsule().fill(theme.line).frame(width: 36, height: 4)
                    .frame(maxWidth: .infinity).padding(.top, 10)
                BloomTitle(prefix: "Settings", em: "", size: 22)

                fieldLabel("Account")
                accountSection

                fieldLabel("Your name")
                TextField("Your name", text: Binding(
                    get: { store.state.settings.name },
                    set: { store.state.settings.name = String($0.prefix(24)); store.save(silent: true) }
                ))
                .textFieldStyle(BloomFieldStyle())

                fieldLabel("Theme")
                HStack(spacing: 6) {
                    themeChip("light", "sun", "light")
                    themeChip("dark", "moon", "dark")
                }

                fieldLabel("Sounds")
                HStack(spacing: 6) {
                    Button {
                        store.state.settings.sound.toggle()
                        store.save(silent: true)
                        MusicEngine.shared.sync(soundOn: store.state.settings.sound, musicOn: store.state.settings.music)
                        Sfx.shared.pop()
                    } label: {
                        Chip(text: store.state.settings.sound ? "sound on" : "sound off",
                             icon: store.state.settings.sound ? "bell" : "bell-off",
                             selected: store.state.settings.sound)
                    }
                    .buttonStyle(.plain)
                    Button {
                        store.state.settings.music.toggle()
                        store.save(silent: true)
                        MusicEngine.shared.sync(soundOn: store.state.settings.sound, musicOn: store.state.settings.music)
                        Sfx.shared.click()
                    } label: {
                        Chip(text: store.state.settings.music ? "music on" : "music off",
                             icon: store.state.settings.music ? "music" : "music-off",
                             selected: store.state.settings.music)
                    }
                    .buttonStyle(.plain)
                    .disabled(!store.state.settings.sound)
                    .opacity(store.state.settings.sound ? 1 : 0.5)
                    Button {
                        store.state.settings.taps.toggle()
                        store.save(silent: true)
                        if store.state.settings.taps { Sfx.shared.click() }
                    } label: {
                        Chip(text: store.state.settings.taps ? "taps on" : "taps off", icon: "bolt",
                             selected: store.state.settings.taps)
                    }
                    .buttonStyle(.plain)
                    .disabled(!store.state.settings.sound)
                    .opacity(store.state.settings.sound ? 1 : 0.5)
                }

                fieldLabel("Time format")
                HStack(spacing: 6) {
                    Button {
                        store.state.settings.hour24 = false
                        store.save()
                    } label: {
                        Chip(text: "12-hour · 3:00 pm", selected: !store.state.settings.hour24)
                    }
                    .buttonStyle(.plain)
                    Button {
                        store.state.settings.hour24 = true
                        store.save()
                    } label: {
                        Chip(text: "24-hour · 15:00", selected: store.state.settings.hour24)
                    }
                    .buttonStyle(.plain)
                }

                fieldLabel("Timer ringer")
                FlowChips(spacing: 6) {
                    ForEach(RINGERS, id: \.key) { r in
                        Button {
                            store.state.settings.ringer = r.key
                            store.save(silent: true)
                            Sfx.shared.ringerPreview(r.key)   // instant preview
                        } label: {
                            Chip(text: r.label, selected: store.state.settings.ringer == r.key)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("Tap one to hear it — it plays when a focus session finishes, even with Bloom closed.")
                    .font(.quicksand(11.5)).foregroundColor(theme.muted)

                fieldLabel("Daily reminder")
                HStack(spacing: 10) {
                    Button {
                        store.state.settings.reminder.toggle()
                        if store.state.settings.reminder { NotificationPlanner.requestPermissionIfNeeded() }
                        store.save(silent: true)
                        Sfx.shared.pop()
                    } label: {
                        Chip(text: store.state.settings.reminder ? "reminder on" : "reminder off",
                             icon: store.state.settings.reminder ? "bell" : "bell-off",
                             selected: store.state.settings.reminder)
                    }
                    .buttonStyle(.plain)
                    if store.state.settings.reminder {
                        Text("at").font(.quicksand(12)).foregroundColor(theme.muted)
                        DatePicker("", selection: Binding(
                            get: {
                                let p = store.state.settings.reminderTime.split(separator: ":").compactMap { Int($0) }
                                return Calendar.current.date(from: DateComponents(hour: p.first ?? 19, minute: p.count > 1 ? p[1] : 0)) ?? Date()
                            },
                            set: {
                                let c = Calendar.current.dateComponents([.hour, .minute], from: $0)
                                store.state.settings.reminderTime = "\(pad2(c.hour ?? 19)):\(pad2(c.minute ?? 0))"
                                store.save(silent: true)
                            }
                        ), displayedComponents: .hourAndMinute)
                        .labelsHidden()
                    }
                }
                Text("A real notification — it fires even when Bloom is closed.")
                    .font(.quicksand(11.5)).foregroundColor(theme.muted)

                fieldLabel("Start over")
                Button {
                    confirmReset = true
                } label: {
                    HStack(spacing: 5) { Ic(name: "reset", size: 13); Text("Reset") }
                }
                .buttonStyle(PillButtonStyle(kind: .danger))

                HStack(spacing: 4) {
                    Text("made with").font(.quicksand(11.5))
                    Ic(name: "heart", size: 11)
                    Text("from Jasmine").font(.quicksand(11.5))
                }
                .foregroundColor(theme.muted)
                .frame(maxWidth: .infinity)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .padding(.horizontal, 22)
        }
        .background(theme.bg)
        .alert("Start completely fresh? Tasks, notes, garden — everything is wiped.", isPresented: $confirmReset) {
            Button("Cancel", role: .cancel) {}
            Button("Wipe it all", role: .destructive) {
                store.reset()
                dismiss()
            }
        }
    }

    private func themeChip(_ value: String, _ icon: String, _ label: String) -> some View {
        Button {
            store.state.settings.theme = value
            store.save(silent: true)
            Sfx.shared.click()
        } label: {
            Chip(text: label, icon: icon, selected: store.state.settings.theme == value)
        }
        .buttonStyle(.plain)
    }

    private func fieldLabel(_ s: String) -> some View {
        Text(s.uppercased()).font(.quicksandBold(10)).kerning(1).foregroundColor(theme.muted).padding(.top, 10)
    }

    // MARK: account

    @ViewBuilder private var accountSection: some View {
        if !Cloud.configured {
            Text("Everything lives on this phone for now.")
                .font(.quicksand(12.5)).foregroundColor(theme.muted)
        } else if cloud.signedIn {
            VStack(alignment: .leading, spacing: 8) {
                (Text("Signed in as ").font(.quicksand(12.5))
                    + Text(cloud.userEmail ?? "you").font(.quicksandBold(12.5))
                    + Text(" — plants, tasks, calendar, notes and your name all save to your account as you go.").font(.quicksand(12.5)))
                    .foregroundColor(theme.muted)
                HStack(spacing: 8) {
                    Chip(text: syncLabel, style: .green)
                    Button("Sign out") {
                        cloud.signOut()
                    }
                    .buttonStyle(PillButtonStyle())
                }
            }
        } else if authStage == "code" {
            VStack(alignment: .leading, spacing: 8) {
                (Text("Check your email — we wrote to ").font(.quicksand(12.5))
                    + Text(email).font(.quicksandBold(12.5))
                    + Text(". Type the code from it here.").font(.quicksand(12.5)))
                    .foregroundColor(theme.muted)
                HStack(spacing: 8) {
                    TextField("6-digit code", text: $code)
                        .textFieldStyle(BloomFieldStyle())
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .frame(width: 140)
                    Button("Sign in") { verify() }
                        .buttonStyle(PillButtonStyle(kind: .primary))
                    Button("different email") { authStage = "start"; authMessage = "" }
                        .buttonStyle(.plain)
                        .font(.quicksandBold(11.5))
                        .foregroundColor(theme.olive2)
                }
                if !authMessage.isEmpty {
                    Text(authMessage).font(.quicksand(11.5)).foregroundColor(theme.coralStrong)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    TextField("you@example.com", text: $email)
                        .textFieldStyle(BloomFieldStyle())
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button(authStage == "busy" ? "Sending…" : "Sign up / Sign in") { sendCode() }
                        .buttonStyle(PillButtonStyle(kind: .primary))
                        .disabled(authStage == "busy")
                }
                Text(authMessage.isEmpty
                     ? "One account, every device — same garden here and on the web. You stay signed in on this phone."
                     : authMessage)
                    .font(.quicksand(11.5))
                    .foregroundColor(authMessage.isEmpty ? theme.muted : theme.coralStrong)
            }
        }
    }

    private var syncLabel: String {
        switch cloud.status {
        case .syncing: return "syncing…"
        case .synced: return "synced"
        case .error: return "sync hiccup — retrying"
        case .idle: return "signed in"
        }
    }

    private func sendCode() {
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard e.contains("@"), e.contains(".") else { Sfx.shared.uhoh(); return }
        email = e
        authStage = "busy"
        authMessage = ""
        Task {
            do {
                try await CloudSync.shared.requestCode(email: e)
                Sfx.shared.chime()
                authStage = "code"
            } catch {
                authMessage = error.localizedDescription
                authStage = "start"
            }
        }
    }

    private func verify() {
        let c = code.trimmingCharacters(in: .whitespaces)
        guard !c.isEmpty else { Sfx.shared.uhoh(); return }
        authMessage = "Checking…"
        Task {
            do {
                try await CloudSync.shared.verifyCode(email: email, code: c)
                Sfx.shared.chime()
                authMessage = ""
                authStage = "start"
                code = ""
            } catch {
                authMessage = error.localizedDescription
            }
        }
    }
}
