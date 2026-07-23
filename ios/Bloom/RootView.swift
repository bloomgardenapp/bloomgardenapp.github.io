// RootView.swift — the shell: Bloom-styled tab bar, overlays (toasts, confetti, zen),
// global timer tick, scene-phase reconciliation, onboarding.
import SwiftUI

enum Tab: String, CaseIterable {
    case today, tasks, focus, garden

    var label: String {
        switch self {
        case .today: return "Today"
        case .tasks: return "Tasks"
        case .focus: return "Focus"
        case .garden: return "Garden"
        }
    }

    var icon: String {
        switch self {
        case .today: return "sun"
        case .tasks: return "check-square"
        case .focus: return "hourglass"
        case .garden: return "sprout"
        }
    }
}

struct RootView: View {
    @Bindable var store: AppStore
    @State private var tab: Tab
    @State private var showSettings: Bool
    @Environment(\.scenePhase) private var scenePhase

    init(store: AppStore) {
        self.store = store
        // Testing hooks, like the web's localhost-only __bloom: launch with
        // "-bloomTab garden" / "-bloomSheet settings" to land on a specific screen.
        #if DEBUG
        _tab = State(initialValue: Tab(rawValue: UserDefaults.standard.string(forKey: "bloomTab") ?? "") ?? .today)
        _showSettings = State(initialValue: UserDefaults.standard.string(forKey: "bloomSheet") == "settings")
        #else
        _tab = State(initialValue: .today)
        _showSettings = State(initialValue: false)
        #endif
    }

    private var theme: BloomTheme { store.state.settings.theme == "dark" ? .dark : .light }
    private let ticker = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            theme.bg.ignoresSafeArea()

            Group {
                switch tab {
                case .today: TodayView(store: store, openSettings: { showSettings = true }, switchTab: { tab = $0 })
                case .tasks: TasksView(store: store)
                case .focus: FocusView(store: store)
                case .garden: GardenView(store: store, openSettings: { showSettings = true })
                }
            }
            .safeAreaInset(edge: .bottom) { tabBar }

            ConfettiOverlay(tick: store.confettiTick)
            ToastOverlay(toasts: store.toasts)
        }
        .environment(\.theme, theme)
        .tint(theme.olive2)
        .preferredColorScheme(theme.isDark ? .dark : .light)
        .fullScreenCover(isPresented: $store.zenPresented) {
            ZenView(store: store)
                .environment(\.theme, theme)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(store: store)
                .environment(\.theme, theme)
                .preferredColorScheme(theme.isDark ? .dark : .light)
        }
        .fullScreenCover(isPresented: .constant(!store.state.settings.onboarded)) {
            OnboardingView(store: store)
                .environment(\.theme, theme)
        }
        .onReceive(ticker) { _ in
            store.checkTimer()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                store.checkTimer()   // a session may have finished while suspended
                if store.state.timer != nil {
                    // a timer synced from another device (or restored) gets its Live Activity here
                    LiveActivityController.shared.startOrUpdate(store: store)
                }
                if CloudSync.shared.signedIn { Task { await CloudSync.shared.firstSync() } }
            }
        }
        .task {
            Sfx.shared.store = store
            CloudSync.shared.start(store: store)
            NotificationPlanner.sync(store: store)
            MusicEngine.shared.sync(soundOn: store.state.settings.sound, musicOn: store.state.settings.music)
            #if DEBUG
            if UserDefaults.standard.bool(forKey: "bloomZen"), store.state.timer != nil {
                store.zenPresented = true
            }
            #endif
        }
    }

    // MARK: - Bloom tab bar (the web sidebar, gone horizontal)

    private var tabBar: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases, id: \.self) { t in
                Button {
                    Sfx.shared.click()
                    tab = t
                } label: {
                    VStack(spacing: 3) {
                        Ic(name: t.icon, size: 17, weight: tab == t ? .semibold : .medium)
                        Text(t.label).font(.quicksandBold(10))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        Capsule().fill(tab == t ? theme.oliveSoft : .clear)
                    )
                    .foregroundColor(tab == t ? theme.olive2 : theme.muted)
                }
                .buttonStyle(.plain)
            }
            if store.state.timer != nil {
                TimerChip(store: store)
                    .onTapGesture { tab = .focus }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            Capsule(style: .continuous)
                .fill(theme.card)
                .overlay(Capsule(style: .continuous).stroke(theme.line, lineWidth: 1))
                .shadow(color: .black.opacity(theme.isDark ? 0.4 : 0.10), radius: 12, y: 4)
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 2)
    }
}

/// Little live countdown pill in the tab bar while a session runs (web's nav-timer-chip).
struct TimerChip: View {
    @Environment(\.theme) private var theme
    var store: AppStore

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { _ in
            let t = store.state.timer
            HStack(spacing: 4) {
                Ic(name: t?.pausedAt != nil ? "pause" : (t?.phase == "break" ? "leaf" : "hourglass"), size: 11)
                Text(fmtClock(store.timerRemaining()))
                    .font(.quicksandBold(12))
                    .monospacedDigit()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Capsule().fill(theme.olive))
            .foregroundColor(Color(hex: "#FFFDF4"))
            .opacity(t?.pausedAt != nil ? 0.65 : 1)
        }
    }
}

// MARK: - View header ("Time to *focus*" pattern)

struct ViewHeader<Trailing: View>: View {
    @Environment(\.theme) private var theme
    var prefix: String
    var em: String
    var icon: String
    var sub: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    (Text(prefix).font(.display(27))
                        + Text(em).font(.displayItalic(27)).foregroundColor(theme.olive2))
                        .foregroundColor(theme.inkStrong)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Ic(name: icon, size: 20).foregroundColor(theme.olive)
                }
                Text(sub).font(.quicksand(13)).foregroundColor(theme.muted)
            }
            Spacer()
            trailing
        }
    }
}
