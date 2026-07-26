// Icons.swift — the web's hand-drawn line-icon keys, mapped to the closest thin
// SF Symbols so synced skills keep their icons. Icon keys live in synced data.
import SwiftUI

let ICON_TO_SF: [String: String] = [
    "sun": "sun.max", "moon": "moon", "check-square": "checkmark.square", "check": "checkmark",
    "calendar": "calendar", "note": "note.text", "hourglass": "hourglass",
    "sprout": "leaf", "leaf": "leaf", "flower": "camera.macro", "daisy": "camera.macro",
    "pine": "tree", "seed": "circle.dotted.circle", "flame": "flame", "stopwatch": "stopwatch",
    "bars": "chart.bar", "bolt": "bolt", "clipboard": "list.clipboard", "gear": "slider.horizontal.3",
    "pin": "pin", "trash": "trash", "pencil": "pencil", "pause": "pause", "play": "play.fill",
    "drop": "drop", "pot": "basket", "clock": "clock", "arrow": "arrow.right", "heart": "heart",
    "bell": "bell", "bell-off": "bell.slash", "download": "arrow.down.circle", "folder": "folder",
    "reset": "arrow.counterclockwise", "help": "questionmark.circle", "repeat": "repeat",
    "expand": "arrow.up.left.and.arrow.down.right", "pip": "pip", "x-circle": "xmark.circle", "x": "xmark",
    "music": "music.note", "music-off": "speaker.slash",
    // subject icons for plants
    "calc": "plus.forwardslash.minus", "book": "book", "code": "chevron.left.forwardslash.chevron.right",
    "globe": "globe", "dumbbell": "dumbbell", "palette": "paintpalette", "flask": "flask",
    "cap": "graduationcap", "pan": "frying.pan", "gamepad": "gamecontroller", "film": "film",
    "ball": "soccerball", "camera": "camera", "chat": "bubble.left", "briefcase": "briefcase",
    "star": "star", "target": "target",
]

/// Skill-editor icon choices, same order as the web.
let SKILL_ICONS = ["sprout", "calc", "book", "code", "globe", "music", "dumbbell", "ball", "palette", "pencil", "flask", "cap", "pan", "gamepad", "briefcase", "film", "camera", "chat", "heart", "star", "target", "leaf", "flower", "pine"]

struct Ic: View {
    var name: String
    var size: CGFloat = 15
    var weight: Font.Weight = .medium

    var body: some View {
        Image(systemName: ICON_TO_SF[name] ?? "leaf")
            .font(.system(size: size, weight: weight))
    }
}
