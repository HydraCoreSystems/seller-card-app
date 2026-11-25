import ExpoModulesCore
import Vision

/// Reads text from a picture on the device and says where each piece sits.
/// Each box is { text, left, top, width, height } with the origin at the top left, in pixels of the image,
/// so the caller can put the pieces in reading order by position instead of trusting the recognizer's order.
public class SkrybixOcrModule: Module {
    public func definition() -> ModuleDefinition {
        Name("SkrybixOcr")

        Constants([
            "isSupported": true
        ])

        AsyncFunction("recognize") { (url: URL, promise: Promise) in
            do {
                let imageData = try Data(contentsOf: url)
                guard let image = UIImage(data: imageData), let cgImage = image.cgImage else {
                    promise.reject("ERR_UNREADABLE_IMAGE", "The picture could not be opened.")
                    return
                }
                let width = Double(cgImage.width)
                let height = Double(cgImage.height)

                let request = VNRecognizeTextRequest { (request, error) in
                    if let error = error {
                        promise.reject("ERR_RECOGNITION", error.localizedDescription)
                        return
                    }
                    let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                    let boxes: [[String: Any]] = observations.compactMap { observation in
                        guard let text = observation.topCandidates(1).first?.string else { return nil }
                        let box = observation.boundingBox
                        // Vision measures from the bottom left, so flip to the top left.
                        return [
                            "text": text,
                            "left": box.minX * width,
                            "top": (1.0 - box.maxY) * height,
                            "width": box.width * width,
                            "height": box.height * height
                        ]
                    }
                    promise.resolve(boxes)
                }
                request.recognitionLevel = .accurate

                let handler = VNImageRequestHandler(cgImage: cgImage)
                try handler.perform([request])
            } catch {
                promise.reject("ERR_RECOGNITION", error.localizedDescription)
            }
        }
    }
}
