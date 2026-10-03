// BloomApp.swift — app entry: one store, one root.
import SwiftUI

@main
struct BloomApp: App {
    @State private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(store: store)
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    // check-offs tapped in the tasks widget land here
                    WidgetSnapshotWriter.applyPendingToggles(store: store)
                    // and re-publish, so a widget left open overnight isn't
                    // still showing yesterday's list
                    WidgetSnapshotWriter.write(store: store)
                }
        }
    }
}
