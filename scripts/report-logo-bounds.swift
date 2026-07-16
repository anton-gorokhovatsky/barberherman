import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
let directory = root.appendingPathComponent("assets/logos-transparent", isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(
  at: directory,
  includingPropertiesForKeys: nil,
  options: [.skipsHiddenFiles]
).filter { $0.pathExtension.lowercased() == "png" }
.sorted { $0.lastPathComponent < $1.lastPathComponent }

for file in files {
  guard let image = NSImage(contentsOf: file) else { continue }
  var rect = CGRect(origin: .zero, size: image.size)
  guard let source = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { continue }

  let width = source.width
  let height = source.height
  let bytesPerRow = width * 4
  var pixels = [UInt8](repeating: 0, count: bytesPerRow * height)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue

  guard let context = CGContext(
    data: &pixels,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else { continue }

  context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))

  var minX = width
  var minY = height
  var maxX = -1
  var maxY = -1
  var alphaTotal = 0.0
  var weightedX = 0.0
  var weightedY = 0.0

  for y in 0..<height {
    for x in 0..<width {
      let alpha = pixels[y * bytesPerRow + x * 4 + 3]
      guard alpha > 8 else { continue }

      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)

      let weight = Double(alpha) / 255
      alphaTotal += weight
      weightedX += Double(x) * weight
      weightedY += Double(y) * weight
    }
  }

  guard maxX >= minX, maxY >= minY, alphaTotal > 0 else { continue }

  let boundsCenterY = (Double(minY) + Double(maxY)) / 2 / Double(height)
  let alphaCenterY = weightedY / alphaTotal / Double(height)
  let visibleHeight = Double(maxY - minY + 1) / Double(height)
  let visibleLeft = Double(minX) / Double(width)
  let visibleRight = Double(maxX + 1) / Double(width)
  let alphaCenterX = weightedX / alphaTotal / Double(width)

  print(String(
    format: "%@ size=%dx%d x=%.3f...%.3f alphaCenterX=%.3f y=%.3f...%.3f visible=%.3f boundsCenter=%.3f alphaCenter=%.3f",
    file.deletingPathExtension().lastPathComponent,
    width,
    height,
    visibleLeft,
    visibleRight,
    alphaCenterX,
    Double(minY) / Double(height),
    Double(maxY + 1) / Double(height),
    visibleHeight,
    boundsCenterY,
    alphaCenterY
  ))
}
