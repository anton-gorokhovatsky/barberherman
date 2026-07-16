import AppKit
import Foundation

let fileManager = FileManager.default
let projectRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
let sourceDirectory = projectRoot.appendingPathComponent("assets/logos", isDirectory: true)
let outputDirectory = projectRoot.appendingPathComponent("assets/logos-transparent", isDirectory: true)
let darkOutputDirectory = projectRoot.appendingPathComponent("assets/logos-dark", isDirectory: true)

try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
try fileManager.createDirectory(at: darkOutputDirectory, withIntermediateDirectories: true)

let sourceFiles = try fileManager.contentsOfDirectory(
  at: sourceDirectory,
  includingPropertiesForKeys: nil,
  options: [.skipsHiddenFiles]
).filter { $0.pathExtension.lowercased() == "png" }

// These marks use white as a positive brand color rather than as paper/matte.
// Every other logo gets true transparent counters as well as a transparent outer field.
let preservesInternalWhite: Set<String> = ["rutv.png"]
let needsDarkVariant: Set<String> = ["amazingred.png", "uomo.png"]

for sourceURL in sourceFiles {
  let outputURL = outputDirectory.appendingPathComponent(sourceURL.lastPathComponent)

  // These sources already have production-ready transparency and must be copied verbatim.
  if ["m24.png", "autoradio.png"].contains(sourceURL.lastPathComponent) {
    if fileManager.fileExists(atPath: outputURL.path) {
      try fileManager.removeItem(at: outputURL)
    }

    try fileManager.copyItem(at: sourceURL, to: outputURL)
    continue
  }

  guard let image = NSImage(contentsOf: sourceURL) else {
    throw NSError(domain: "LogoMatte", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(sourceURL.path)"])
  }

  var imageRect = CGRect(origin: .zero, size: image.size)
  guard let sourceImage = image.cgImage(forProposedRect: &imageRect, context: nil, hints: nil) else {
    throw NSError(domain: "LogoMatte", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot decode \(sourceURL.path)"])
  }

  let width = sourceImage.width
  let height = sourceImage.height
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
  ) else {
    throw NSError(domain: "LogoMatte", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot create bitmap for \(sourceURL.path)"])
  }

  context.interpolationQuality = .none
  context.draw(sourceImage, in: CGRect(x: 0, y: 0, width: width, height: height))

  let pixelCount = width * height
  var connected = [Bool](repeating: false, count: pixelCount)
  var queue = [Int]()
  queue.reserveCapacity(pixelCount)

  func canJoinMatte(_ pixelIndex: Int) -> Bool {
    let offset = pixelIndex * 4
    return min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 32
  }

  func enqueue(_ pixelIndex: Int) {
    guard !connected[pixelIndex], canJoinMatte(pixelIndex) else { return }
    connected[pixelIndex] = true
    queue.append(pixelIndex)
  }

  for x in 0..<width {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }

  if height > 2 {
    for y in 1..<(height - 1) {
      enqueue(y * width)
      enqueue(y * width + width - 1)
    }
  }

  if !preservesInternalWhite.contains(sourceURL.lastPathComponent) {
    for pixelIndex in 0..<pixelCount {
      let offset = pixelIndex * 4
      let minimumChannel = min(pixels[offset], pixels[offset + 1], pixels[offset + 2])

      if minimumChannel > 248 {
        enqueue(pixelIndex)
      }
    }
  }

  var head = 0

  while head < queue.count {
    let pixelIndex = queue[head]
    head += 1
    let x = pixelIndex % width
    let y = pixelIndex / width

    if x > 0 { enqueue(pixelIndex - 1) }
    if x + 1 < width { enqueue(pixelIndex + 1) }
    if y > 0 { enqueue(pixelIndex - width) }
    if y + 1 < height { enqueue(pixelIndex + width) }
  }

  for pixelIndex in 0..<pixelCount where connected[pixelIndex] {
    let offset = pixelIndex * 4
    let minimumChannel = min(pixels[offset], pixels[offset + 1], pixels[offset + 2])
    let inferredAlpha = 1 - Double(minimumChannel) / 255

    guard inferredAlpha > 0.01 else {
      pixels[offset] = 0
      pixels[offset + 1] = 0
      pixels[offset + 2] = 0
      pixels[offset + 3] = 0
      continue
    }

    let whiteContribution = 255 * (1 - inferredAlpha)
    let outputAlpha = Double(pixels[offset + 3]) * inferredAlpha

    for channel in 0..<3 {
      let recovered = max(0, min(255, (Double(pixels[offset + channel]) - whiteContribution) / inferredAlpha))
      pixels[offset + channel] = UInt8(round(recovered * outputAlpha / 255))
    }

    pixels[offset + 3] = UInt8(round(outputAlpha))
  }

  // RU.TV keeps its white "TV" lettering, so only the counter in the left-hand R is cleared.
  for pixelIndex in 0..<pixelCount {
    let x = pixelIndex % width
    let offset = pixelIndex * 4
    let alpha = pixels[offset + 3]

    guard alpha > 0 else { continue }

    let red = pixels[offset]
    let green = pixels[offset + 1]
    let blue = pixels[offset + 2]
    let maximum = max(red, green, blue)
    let minimum = min(red, green, blue)
    let isNeutralPaper = maximum - minimum < 20 && minimum > 176
    let isRutvCounter = sourceURL.lastPathComponent == "rutv.png" && x < width * 2 / 5

    guard isNeutralPaper && isRutvCounter else { continue }

    let paperAmount = max(0, min(1, (Double(minimum) - 176) / 79))
    let remainingAlpha = Double(alpha) * (1 - paperAmount)
    let scale = alpha > 0 ? remainingAlpha / Double(alpha) : 0

    pixels[offset] = UInt8(round(Double(red) * scale))
    pixels[offset + 1] = UInt8(round(Double(green) * scale))
    pixels[offset + 2] = UInt8(round(Double(blue) * scale))
    pixels[offset + 3] = UInt8(round(remainingAlpha))
  }

  guard let outputImage = context.makeImage() else {
    throw NSError(domain: "LogoMatte", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot encode \(outputURL.path)"])
  }

  let bitmap = NSBitmapImageRep(cgImage: outputImage)
  guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "LogoMatte", code: 5, userInfo: [NSLocalizedDescriptionKey: "Cannot create PNG for \(outputURL.path)"])
  }

  try pngData.write(to: outputURL, options: .atomic)

  if needsDarkVariant.contains(sourceURL.lastPathComponent) {
    var darkPixels = pixels

    for pixelIndex in 0..<pixelCount {
      let offset = pixelIndex * 4
      let alpha = darkPixels[offset + 3]

      guard alpha > 0 else { continue }

      let red = darkPixels[offset]
      let green = darkPixels[offset + 1]
      let blue = darkPixels[offset + 2]
      let maximum = max(red, green, blue)
      let minimum = min(red, green, blue)

      if maximum - minimum < 10, maximum < 72 {
        darkPixels[offset] = alpha
        darkPixels[offset + 1] = alpha
        darkPixels[offset + 2] = alpha
      }
    }

    guard let darkContext = CGContext(
      data: &darkPixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: bytesPerRow,
      space: colorSpace,
      bitmapInfo: bitmapInfo
    ), let darkImage = darkContext.makeImage() else {
      throw NSError(domain: "LogoMatte", code: 6, userInfo: [NSLocalizedDescriptionKey: "Cannot create dark variant for \(sourceURL.path)"])
    }

    let darkBitmap = NSBitmapImageRep(cgImage: darkImage)
    guard let darkPngData = darkBitmap.representation(using: .png, properties: [:]) else {
      throw NSError(domain: "LogoMatte", code: 7, userInfo: [NSLocalizedDescriptionKey: "Cannot encode dark variant for \(sourceURL.path)"])
    }

    try darkPngData.write(
      to: darkOutputDirectory.appendingPathComponent(sourceURL.lastPathComponent),
      options: .atomic
    )
  }
}

print("Prepared \(sourceFiles.count) transparent logo assets and \(needsDarkVariant.count) dark variants")
