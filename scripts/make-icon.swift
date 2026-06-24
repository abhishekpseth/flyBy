// Generates a 1024×1024 PNG app icon: a white airplane on a blue gradient,
// macOS-style rounded square. Usage: swift scripts/make-icon.swift out.png
import AppKit

let size: CGFloat = 1024
let outPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"

let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()

// Rounded-square background with a blue gradient (Apple "squircle" corner ratio).
let rect = NSRect(x: 0, y: 0, width: size, height: size)
let radius = size * 0.2237
let bg = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
let gradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.27, green: 0.62, blue: 1.00, alpha: 1),
    NSColor(calibratedRed: 0.04, green: 0.29, blue: 0.78, alpha: 1)
])!
gradient.draw(in: bg, angle: -90)

// White airplane (SF Symbol), centered.
let config = NSImage.SymbolConfiguration(pointSize: size * 0.52, weight: .semibold)
if let base = NSImage(systemSymbolName: "airplane", accessibilityDescription: nil)?
    .withSymbolConfiguration(config) {
    let s = base.size
    let tinted = NSImage(size: s)
    tinted.lockFocus()
    base.draw(in: NSRect(origin: .zero, size: s))
    NSColor.white.set()
    NSRect(origin: .zero, size: s).fill(using: .sourceAtop)
    tinted.unlockFocus()
    tinted.draw(in: NSRect(x: (size - s.width) / 2,
                           y: (size - s.height) / 2,
                           width: s.width, height: s.height))
}

img.unlockFocus()

guard let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    FileHandle.standardError.write("failed to render icon\n".data(using: .utf8)!)
    exit(1)
}
try! png.write(to: URL(fileURLWithPath: outPath))
