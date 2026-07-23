// Music.swift — the soft generative lofi study loop from audio.js, rendered bar by
// bar (Fmaj7 → Em7 → Dm7 → Cmaj7, ~74bpm, swung hats, vinyl crackle) and scheduled
// gaplessly. With the audio background mode it keeps playing while the phone is locked.
import Foundation
import AVFoundation

final class MusicEngine {
    static let shared = MusicEngine()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    private let queue = DispatchQueue(label: "bloom.music")
    private var attached = false
    private var bar = 0
    private var carry: [Float] = []
    private(set) var playing = false

    private let SR = 44100.0
    private let BEAT = 60.0 / 74.0
    private var BAR: Double { BEAT * 4 }
    private var SWING: Double { BEAT * 0.14 }

    // Fmaj7 → Em7 → Dm7 → Cmaj7
    private let CHORDS: [[Double]] = [
        [174.61, 220.0, 261.63, 329.63],
        [164.81, 196.0, 246.94, 293.66],
        [146.83, 174.61, 220.0, 261.63],
        [130.81, 164.81, 196.0, 246.94],
    ]
    private let PENTA: [Double] = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46]

    /// Follow settings: sound && music → start, else stop.
    func sync(soundOn: Bool, musicOn: Bool) {
        if soundOn && musicOn { start() } else { stop() }
    }

    func start() {
        queue.async {
            guard !self.playing else { return }
            if !self.attached {
                self.engine.attach(self.player)
                self.engine.connect(self.player, to: self.engine.mainMixerNode, format: self.format)
                self.attached = true
            }
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            guard (try? self.engine.start()) != nil else { return }
            self.playing = true
            self.bar = 0
            self.carry = []
            self.player.play()
            for _ in 0..<3 { self.scheduleNextBar() }
        }
    }

    func stop() {
        queue.async {
            guard self.playing else { return }
            self.playing = false
            self.player.stop()
        }
    }

    private func scheduleNextBar() {
        guard playing else { return }
        let samples = renderBar(bar)
        bar += 1
        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)) else { return }
        buf.frameLength = AVAudioFrameCount(samples.count)
        samples.withUnsafeBufferPointer { src in
            buf.floatChannelData![0].update(from: src.baseAddress!, count: samples.count)
        }
        player.scheduleBuffer(buf) { [weak self] in
            self?.queue.async { self?.scheduleNextBar() }
        }
    }

    // MARK: - offline bar rendering (voices from audio.js)

    private func renderBar(_ barIndex: Int) -> [Float] {
        let tailLen = 3.0
        var mix = [Float](repeating: 0, count: Int((BAR + tailLen) * SR))

        func addSine(_ f0: Double, at: Double, dur: Double, attack: Double, vol: Double,
                     glideTo: Double? = nil, glideDur: Double = 0, lp: Double = 0) {
            let start = Int(at * SR)
            let n = Int(dur * SR)
            var phase = 0.0
            var lpState = 0.0
            let aN = max(1, Int(attack * SR))
            for i in 0..<n {
                let idx = start + i
                guard idx < mix.count else { break }
                var f = f0
                if let g = glideTo, glideDur > 0 {
                    let gp = min(1, Double(i) / (glideDur * SR))
                    f = f0 * pow(g / f0, gp)
                }
                phase += f / SR
                var s = sin(2 * .pi * phase)
                let env: Double = i < aN
                    ? pow(10, -4 + 4 * Double(i) / Double(aN))
                    : pow(10, -4 * Double(i - aN) / Double(max(1, n - aN)))
                s *= env * vol
                if lp > 0 {
                    let a = 1 - exp(-2 * .pi * lp / SR)
                    lpState += a * (s - lpState)
                    s = lpState
                }
                mix[idx] += Float(s)
            }
        }

        // Rhodes-ish electric piano: fundamental + faint bell overtone, muffled top
        func ep(_ f: Double, _ t: Double, _ dur: Double = 2.4, _ vol: Double = 0.042) {
            addSine(f, at: t, dur: dur, attack: 0.015, vol: vol, lp: 1800)
            addSine(f * 2.004, at: t, dur: dur, attack: 0.015, vol: vol * 0.28, lp: 1800)
        }
        func bass(_ f: Double, _ t: Double, _ dur: Double) {
            addSine(f, at: t, dur: dur, attack: 0.04, vol: 0.065)
        }
        func kick(_ t: Double, _ vol: Double = 0.12) {
            addSine(105, at: t, dur: 0.24, attack: 0.002, vol: vol, glideTo: 45, glideDur: 0.11)
        }
        func noiseHit(_ t: Double, dur: Double, vol: Double, lo: Double, hi: Double) {
            let start = Int(t * SR)
            let n = Int(dur * SR)
            var lpLo = 0.0, lpHi = 0.0
            let aLo = 1 - exp(-2 * .pi * lo / SR)
            let aHi = 1 - exp(-2 * .pi * hi / SR)
            for i in 0..<n {
                let idx = start + i
                guard idx < mix.count else { break }
                let white = Double.random(in: -1...1)
                lpLo += aLo * (white - lpLo)
                lpHi += aHi * (white - lpHi)
                let band = lpHi - lpLo   // crude bandpass lo..hi
                let env = pow(10, -3 * Double(i) / Double(max(1, n)))
                mix[idx] += Float(band * vol * env)
            }
        }
        func snare(_ t: Double) { noiseHit(t, dur: 0.16, vol: 0.13, lo: 1400, hi: 2600) }
        func hat(_ t: Double, _ vol: Double) { noiseHit(t, dur: 0.04, vol: vol * 3, lo: 6500, hi: 14000) }

        let chord = CHORDS[barIndex % CHORDS.count]
        // chord stab on 1, softer echo stab on the and-of-2 most bars
        for (i, f) in chord.enumerated() { ep(f, Double(i) * 0.03) }
        if Double.random(in: 0..<1) < 0.7 {
            for (i, f) in chord.enumerated() { ep(f, BEAT * 1.5 + SWING + Double(i) * 0.03, 1.2, 0.022) }
        }
        // bass: root on 1, root or fifth on 3
        bass(chord[0] / 2, 0, BEAT * 1.6)
        bass((Double.random(in: 0..<1) < 0.4 ? chord[2] : chord[0]) / 2, BEAT * 2, BEAT * 1.4)
        // drums: kicks on 1 & 3 (ghost before 4 sometimes), snares on 2 & 4, swung hats
        kick(0)
        kick(BEAT * 2, 0.09)
        if Double.random(in: 0..<1) < 0.3 { kick(BEAT * 2.75, 0.06) }
        snare(BEAT)
        snare(BEAT * 3)
        for i in 0..<8 where Double.random(in: 0..<1) >= 0.12 {
            hat(BEAT * Double(i) / 2 + (i % 2 == 1 ? SWING : 0), 0.011 + Double.random(in: 0..<0.008))
        }
        // vinyl crackle pops
        for _ in 0..<(2 + Int.random(in: 0..<4)) {
            noiseHit(Double.random(in: 0..<BAR), dur: 0.02, vol: 0.004 + Double.random(in: 0..<0.007), lo: 2500, hi: 9000)
        }
        // a lazy pentatonic sprinkle now and then
        if Double.random(in: 0..<1) < 0.6 {
            let f = PENTA.randomElement()! / (Double.random(in: 0..<1) < 0.3 ? 2 : 1)
            ep(f, BEAT * (1 + Double(Int.random(in: 0..<5)) * 0.5) + SWING, 1.4, 0.026)
        }
        // dusty vinyl bed under everything
        var brown = 0.0
        var bedLp = 0.0
        let bedA = 1 - exp(-2 * .pi * 240 / SR)
        for i in 0..<Int(BAR * SR) {
            let white = Double.random(in: -1...1)
            brown = (brown + 0.02 * white) / 1.02
            bedLp += bedA * (brown * 3.5 - bedLp)
            mix[i] += Float(bedLp * 0.008)
        }

        // overlap-add last bar's tail, keep this bar's tail for the next
        var out = Array(mix[0..<Int(BAR * SR)])
        for (i, s) in carry.enumerated() where i < out.count { out[i] += s }
        carry = Array(mix[Int(BAR * SR)...])
        // gentle soft clip in place of the web's compressor
        for i in out.indices { out[i] = tanh(out[i] * 1.1) }
        return out
    }
}
