// Synth.swift — audio.js ported: every pattern is rendered offline into a PCM buffer
// (same envelopes, same frequencies) and played through one small engine.
import Foundation
import AVFoundation

private let SR = 44100.0

/// One tone in a pattern — mirrors tone() in audio.js.
struct ToneSpec {
    var freq: Double
    var t: Double = 0          // start offset (s)
    var dur: Double = 0.15
    var triangle = false       // web: type 'sine' | 'triangle'
    var vol: Double = 0.16
    var glide: Double = 0      // freq multiplies toward freq*glide over dur*0.7
    var lp: Double = 0         // one-pole lowpass cutoff
    var tap: Double = 0        // contact-noise volume (web tap())
}

enum SfxPattern {
    case click, pop, start, chime, level, uhoh

    var tones: [ToneSpec] {
        func tok(_ f: Double, t: Double = 0, vol: Double = 0.055, dur: Double = 0.09) -> ToneSpec {
            ToneSpec(freq: f, t: t, dur: dur, triangle: true, vol: vol, lp: 1600, tap: vol * 0.3)
        }
        switch self {
        case .click: return [tok(620)]
        case .pop: return [tok(523), tok(784, t: 0.09, dur: 0.12)]
        case .start: return [tok(440, dur: 0.11), tok(587, t: 0.11, dur: 0.14)]
        case .chime: return [659, 784, 988, 1319].enumerated().map { i, f in
            ToneSpec(freq: Double(f), t: Double(i) * 0.13, dur: 0.4, vol: 0.14)
        }
        case .level: return [523, 659, 784, 1047].enumerated().map { i, f in
            tok(Double(f), t: Double(i) * 0.09, vol: 0.07, dur: 0.22)
        }
        case .uhoh: return [tok(494, dur: 0.11), tok(370, t: 0.11, dur: 0.16)]
        }
    }
}

/// The four ringers (audio.js RINGERS) as tone patterns + their repeat span.
func ringerTones(_ key: String) -> (tones: [ToneSpec], span: Double)? {
    switch key {
    case "chime":
        return ([659, 784, 988, 1319].enumerated().map { i, f in
            ToneSpec(freq: Double(f), t: Double(i) * 0.13, dur: 0.55, vol: 0.26)
        }, 1.1)
    case "bell":
        return ([
            ToneSpec(freq: 880, dur: 1.2, vol: 0.24), ToneSpec(freq: 1760, dur: 0.7, vol: 0.08),
            ToneSpec(freq: 659, t: 0.55, dur: 1.4, vol: 0.24), ToneSpec(freq: 1318, t: 0.55, dur: 0.8, vol: 0.08),
        ], 2.1)
    case "birdsong":
        return ([(2300.0, 0.0), (2700, 0.1), (2450, 0.22), (3000, 0.36), (2600, 0.52), (3150, 0.64)].map { f, t in
            ToneSpec(freq: f, t: t, dur: 0.1, vol: 0.13, glide: 1.25)
        }, 0.95)
    case "marimba":
        return ([1047, 784, 659, 523, 659, 784].enumerated().map { i, f in
            ToneSpec(freq: Double(f), t: Double(i) * 0.11, dur: 0.28, triangle: true, vol: 0.28)
        }, 1.0)
    default:
        return nil   // silent
    }
}

/// Renders a pattern into samples — shared by playback and the .caf generator script.
func renderTones(_ tones: [ToneSpec], pad: Double = 0.1) -> [Float] {
    let total = (tones.map { $0.t + $0.dur }.max() ?? 0) + pad
    var out = [Float](repeating: 0, count: Int(total * SR))
    var rng = SystemRandomNumberGenerator()

    for spec in tones {
        let start = Int(spec.t * SR)
        let n = Int(spec.dur * SR)
        var phase = 0.0
        var lpState = 0.0
        let attack = max(1, Int(0.02 * SR))
        for i in 0..<n {
            let tt = Double(i) / SR
            // exponential glide over 70% of the duration, like exponentialRampToValueAtTime
            var f = spec.freq
            if spec.glide > 0 {
                let gp = min(1, tt / (spec.dur * 0.7))
                f = spec.freq * pow(spec.glide, gp)
            }
            phase += f / SR
            let x = phase - floor(phase)
            var s = spec.triangle ? (abs(4 * x - 2) - 1) : sin(2 * .pi * x)
            // envelope: quick exponential attack, exponential decay to the end
            let env: Double
            if i < attack {
                env = pow(10, -4 + 4 * Double(i) / Double(attack))   // 0.0001 → 1
            } else {
                let dp = Double(i - attack) / Double(max(1, n - attack))
                env = pow(10, -4 * dp)                               // 1 → 0.0001
            }
            s *= env * spec.vol
            if spec.lp > 0 {
                let a = 1 - exp(-2 * .pi * spec.lp / SR)
                lpState += a * (s - lpState)
                s = lpState
            }
            let idx = start + i
            if idx < out.count { out[idx] += Float(s) }
        }
        // the tiny contact noise that makes a synth tone read as a physical "tok"
        if spec.tap > 0 {
            let tn = Int(0.015 * SR)
            var tapLp = 0.0
            let a = 1 - exp(-2 * .pi * 2000 / SR)
            for i in 0..<tn {
                let idx = start + i
                guard idx < out.count else { break }
                let white = Double.random(in: -1...1, using: &rng) * (1 - Double(i) / Double(tn))
                tapLp += a * (white - tapLp)
                out[idx] += Float(tapLp * spec.tap)
            }
        }
    }
    return out
}

enum Synth {
    private static let engine = AVAudioEngine()
    private static var players: [AVAudioPlayerNode] = []
    private static var nextPlayer = 0
    private static var started = false
    private static let format = AVAudioFormat(standardFormatWithSampleRate: SR, channels: 1)!

    private static func ensureEngine() -> Bool {
        if !started {
            for _ in 0..<4 {
                let p = AVAudioPlayerNode()
                engine.attach(p)
                engine.connect(p, to: engine.mainMixerNode, format: format)
                players.append(p)
            }
            started = true
        }
        if !engine.isRunning {
            // .ambient: respects the silent switch and mixes with other audio, like a web page
            try? AVAudioSession.sharedInstance().setCategory(MusicEngine.shared.playing ? .playback : .ambient, options: [.mixWithOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            try? engine.start()
        }
        return engine.isRunning
    }

    private static func play(samples: [Float]) {
        guard !samples.isEmpty, ensureEngine(),
              let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count))
        else { return }
        buf.frameLength = AVAudioFrameCount(samples.count)
        samples.withUnsafeBufferPointer { src in
            buf.floatChannelData![0].update(from: src.baseAddress!, count: samples.count)
        }
        let p = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        p.scheduleBuffer(buf, at: nil)
        p.play()
    }

    static func play(_ pattern: SfxPattern) {
        DispatchQueue.global(qos: .userInitiated).async {
            play(samples: renderTones(pattern.tones))
        }
    }

    /// repeats > 1 turns the ringer into a real alarm — the pattern plays back-to-back.
    static func playRinger(_ key: String, repeats: Int) {
        guard let r = ringerTones(key) else { return }
        DispatchQueue.global(qos: .userInitiated).async {
            var tones: [ToneSpec] = []
            for i in 0..<max(1, repeats) {
                for var t in r.tones {
                    t.t += Double(i) * r.span
                    tones.append(t)
                }
            }
            play(samples: renderTones(tones))
        }
    }
}
