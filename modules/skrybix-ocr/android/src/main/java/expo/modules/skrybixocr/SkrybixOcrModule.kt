package expo.modules.skrybixocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Reads text from a picture on the device and says where each line sits.
 * Each box is { text, left, top, width, height } in pixels of the image, origin at the top left.
 * Uses the bundled ML Kit model, not the one Google Play Services downloads after install.
 */
class SkrybixOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SkrybixOcr")

    Constants(
      "isSupported" to true
    )

    AsyncFunction("recognize") { uriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw CodedException("ERR_NO_CONTEXT", "The app was not ready to read pictures.", null)
        val uri = if (uriString.startsWith("content://") || uriString.startsWith("file://")) {
          Uri.parse(uriString)
        } else {
          val file = File(uriString)
          if (!file.exists()) {
            throw CodedException("ERR_FILE_MISSING", "The picture was not found.", null)
          }
          Uri.fromFile(file)
        }

        val inputImage = InputImage.fromFilePath(context, uri)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(inputImage)
          .addOnSuccessListener { visionText ->
            val boxes = visionText.textBlocks.flatMap { it.lines }.mapNotNull { line ->
              val rect = line.boundingBox ?: return@mapNotNull null
              mapOf(
                "text" to line.text,
                "left" to rect.left.toDouble(),
                "top" to rect.top.toDouble(),
                "width" to rect.width().toDouble(),
                "height" to rect.height().toDouble()
              )
            }
            promise.resolve(boxes)
          }
          .addOnFailureListener { error ->
            promise.reject(CodedException("ERR_RECOGNITION", error.message ?: "Text reading failed.", error))
          }
      } catch (error: CodedException) {
        promise.reject(error)
      } catch (error: Exception) {
        promise.reject(CodedException("ERR_RECOGNITION", error.message ?: "Text reading failed.", error))
      }
    }
  }
}
